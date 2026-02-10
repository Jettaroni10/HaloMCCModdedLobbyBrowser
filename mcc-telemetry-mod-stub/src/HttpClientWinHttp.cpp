#include "HttpClientWinHttp.h"

#include <Windows.h>
#include <winhttp.h>

#include <string>

#pragma comment(lib, "winhttp.lib")

namespace mccmod {
namespace {

std::wstring Utf8ToWide(const std::string& utf8) {
  if (utf8.empty()) return {};
  const int required = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
  if (required <= 0) return {};

  std::wstring wide(required, L'\0');
  const int written =
      MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, wide.data(), required);
  if (written <= 0) return {};
  if (!wide.empty() && wide.back() == L'\0') wide.pop_back();
  return wide;
}

struct ParsedUrl {
  std::wstring host;
  std::wstring path;
  INTERNET_PORT port = 0;
  bool is_https = false;
};

bool ParseUrl(const std::string& url, ParsedUrl* out) {
  std::wstring wide_url = Utf8ToWide(url);
  if (wide_url.empty()) return false;

  URL_COMPONENTS components{};
  components.dwStructSize = sizeof(URL_COMPONENTS);
  components.dwSchemeLength = static_cast<DWORD>(-1);
  components.dwHostNameLength = static_cast<DWORD>(-1);
  components.dwUrlPathLength = static_cast<DWORD>(-1);
  components.dwExtraInfoLength = static_cast<DWORD>(-1);

  if (!WinHttpCrackUrl(wide_url.c_str(), static_cast<DWORD>(wide_url.size()), 0,
                       &components)) {
    return false;
  }

  out->host.assign(components.lpszHostName, components.dwHostNameLength);
  out->path.assign(components.lpszUrlPath, components.dwUrlPathLength);
  if (components.dwExtraInfoLength > 0) {
    out->path.append(components.lpszExtraInfo, components.dwExtraInfoLength);
  }

  if (out->path.empty()) {
    out->path = L"/";
  }

  out->port = components.nPort;
  out->is_https = components.nScheme == INTERNET_SCHEME_HTTPS;
  return true;
}

}  // namespace

HttpResponse HttpPostJson(const std::string& url, const std::string& json_body) {
  HttpResponse result;

  ParsedUrl parsed;
  if (!ParseUrl(url, &parsed)) {
    result.error = "Failed to parse endpoint URL.";
    return result;
  }

  HINTERNET session = WinHttpOpen(L"MccTelemetryMod/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                  WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
  if (!session) {
    result.error = "WinHttpOpen failed.";
    return result;
  }

  HINTERNET connection = WinHttpConnect(session, parsed.host.c_str(), parsed.port, 0);
  if (!connection) {
    WinHttpCloseHandle(session);
    result.error = "WinHttpConnect failed.";
    return result;
  }

  DWORD flags = parsed.is_https ? WINHTTP_FLAG_SECURE : 0;
  HINTERNET request = WinHttpOpenRequest(connection, L"POST", parsed.path.c_str(), nullptr,
                                         WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
                                         flags);
  if (!request) {
    WinHttpCloseHandle(connection);
    WinHttpCloseHandle(session);
    result.error = "WinHttpOpenRequest failed.";
    return result;
  }

  const wchar_t* headers = L"Content-Type: application/json\r\n";
  BOOL sent = WinHttpSendRequest(request, headers, static_cast<DWORD>(-1),
                                 (LPVOID)json_body.data(),
                                 static_cast<DWORD>(json_body.size()),
                                 static_cast<DWORD>(json_body.size()), 0);

  if (!sent || !WinHttpReceiveResponse(request, nullptr)) {
    result.error = "HTTP request failed.";
  } else {
    DWORD status_code = 0;
    DWORD size = sizeof(status_code);
    if (WinHttpQueryHeaders(request,
                            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &status_code, &size,
                            WINHTTP_NO_HEADER_INDEX)) {
      result.status_code = status_code;
      result.ok = status_code >= 200 && status_code < 300;
      if (!result.ok) {
        result.error = "Receiver returned non-success status.";
      }
    } else {
      result.error = "Failed to read HTTP status code.";
    }
  }

  WinHttpCloseHandle(request);
  WinHttpCloseHandle(connection);
  WinHttpCloseHandle(session);
  return result;
}

}  // namespace mccmod
