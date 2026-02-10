#pragma once

#include <string>

namespace mccmod {

struct HttpResponse {
  bool ok = false;
  unsigned long status_code = 0;
  std::string error;
};

HttpResponse HttpPostJson(const std::string& url, const std::string& json_body);

}  // namespace mccmod
