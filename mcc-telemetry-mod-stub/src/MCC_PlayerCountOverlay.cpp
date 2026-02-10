#include <Windows.h>
#include <TlHelp32.h>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {
constexpr int kMaxPlayers = 24;
constexpr int kMapStabilizeTicks = 3;
constexpr int kModeStabilizeTicks = 3;
constexpr int kPlayerStabilizeTicks = 2;
constexpr bool kUseMapWhitelist = false;
constexpr int kPollIntervalMs = 200;
constexpr uintptr_t kSharedTelemetryBaseOffset = 0x4001590;
constexpr uintptr_t kMapNameOffset = 0x44D;
constexpr uintptr_t kModeNameOffsetPrimary = 0x3C4;
constexpr uintptr_t kModeNameOffsetSecondary = 0x8B8;

inline bool IsReaderDebugEnabled() {
    const char* value = std::getenv("HMCC_READER_DEBUG");
    return value && _stricmp(value, "1") == 0;
}

inline std::string FormatWin32ErrorMessage(DWORD error) {
    if (error == 0) {
        return "OK";
    }
    LPSTR messageBuffer = nullptr;
    DWORD size = FormatMessageA(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        nullptr,
        error,
        MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
        reinterpret_cast<LPSTR>(&messageBuffer),
        0,
        nullptr
    );
    std::string message = size ? std::string(messageBuffer, size) : "Unknown error";
    if (messageBuffer) {
        LocalFree(messageBuffer);
    }
    // Trim trailing newlines/spaces from FormatMessage.
    while (!message.empty() && (message.back() == '\r' || message.back() == '\n' || message.back() == ' ')) {
        message.pop_back();
    }
    return message;
}

enum class ProcessEventType {
    None,
    Started,
    Stopped,
    Changed
};

struct ProcessEvent {
    ProcessEventType type = ProcessEventType::None;
    DWORD pid = 0;
};

template<typename T>
struct ConsensusResult {
    T value{};
    int total = 0;
    int bestCount = 0;
    bool hasValue = false;
};

template<typename T>
ConsensusResult<T> ComputeConsensus(const std::vector<T>& values) {
    ConsensusResult<T> result;
    if (values.empty()) {
        return result;
    }

    std::map<T, int> frequency;
    for (const auto& val : values) {
        frequency[val]++;
    }

    auto mostFrequent = std::max_element(
        frequency.begin(),
        frequency.end(),
        [](const auto& a, const auto& b) { return a.second < b.second; }
    );

    result.total = static_cast<int>(values.size());
    result.bestCount = mostFrequent->second;
    result.value = mostFrequent->first;
    result.hasValue = true;
    return result;
}

inline float CalculateConfidence(int bestCount, int total) {
    if (total <= 0 || bestCount <= 0) {
        return 0.0f;
    }
    return static_cast<float>(bestCount) / static_cast<float>(total);
}

inline uint64_t NowSteadyMs() {
    const auto now = std::chrono::steady_clock::now();
    return static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count()
    );
}

inline std::string TrimCopy(const std::string& input) {
    size_t start = 0;
    while (start < input.size() && std::isspace(static_cast<unsigned char>(input[start]))) {
        ++start;
    }
    size_t end = input.size();
    while (end > start && std::isspace(static_cast<unsigned char>(input[end - 1]))) {
        --end;
    }
    return input.substr(start, end - start);
}

inline std::string TimestampNow() {
    SYSTEMTIME st = {};
    GetLocalTime(&st);
    char buffer[64] = {};
    std::snprintf(
        buffer,
        sizeof(buffer),
        "%04u-%02u-%02u %02u:%02u:%02u.%03u",
        static_cast<unsigned>(st.wYear),
        static_cast<unsigned>(st.wMonth),
        static_cast<unsigned>(st.wDay),
        static_cast<unsigned>(st.wHour),
        static_cast<unsigned>(st.wMinute),
        static_cast<unsigned>(st.wSecond),
        static_cast<unsigned>(st.wMilliseconds)
    );
    return std::string(buffer);
}

struct StringSignal {
    int stabilizeTicks = 3;
    std::string stableValue;
    std::string lastCandidate;
    int streak = 0;
    float confidence = 0.0f;
    std::string sourceTag = "none";
    uint64_t lastStableMs = 0;
    bool hasStable = false;
    bool updatedThisTick = false;

    explicit StringSignal(int stabilize)
        : stabilizeTicks(stabilize) {}

    void Reset() {
        stableValue.clear();
        lastCandidate.clear();
        streak = 0;
        confidence = 0.0f;
        sourceTag = "none";
        lastStableMs = 0;
        hasStable = false;
        updatedThisTick = false;
    }

    std::string Update(const std::vector<std::string>& candidates) {
        const uint64_t nowMs = NowSteadyMs();
        updatedThisTick = false;
        const auto consensus = ComputeConsensus(candidates);
        confidence = CalculateConfidence(consensus.bestCount, consensus.total);
        if (consensus.total > 1) {
            sourceTag = "consensus";
        } else if (consensus.total == 1) {
            sourceTag = "single";
        } else {
            sourceTag = "none";
        }

        if (!consensus.hasValue) {
            return hasStable ? stableValue : "Unknown";
        }

        if (consensus.value == lastCandidate) {
            streak++;
        } else {
            lastCandidate = consensus.value;
            streak = 1;
        }

        if (streak >= stabilizeTicks) {
            stableValue = consensus.value;
            lastStableMs = nowMs;
            hasStable = true;
            updatedThisTick = true;
        }

        return hasStable ? stableValue : "Unknown";
    }
};

struct IntSignal {
    int stabilizeTicks = 2;
    int stableValue = 0;
    int lastCandidate = 0;
    int streak = 0;
    bool hasStable = false;
    float confidence = 0.0f;
    std::string sourceTag = "none";
    uint64_t lastStableMs = 0;
    bool updatedThisTick = false;

    explicit IntSignal(int stabilize)
        : stabilizeTicks(stabilize) {}

    void Reset() {
        stableValue = 0;
        lastCandidate = 0;
        streak = 0;
        hasStable = false;
        confidence = 0.0f;
        sourceTag = "none";
        lastStableMs = 0;
        updatedThisTick = false;
    }

    int Update(const std::vector<int>& candidates) {
        const uint64_t nowMs = NowSteadyMs();
        updatedThisTick = false;
        const auto consensus = ComputeConsensus(candidates);
        confidence = CalculateConfidence(consensus.bestCount, consensus.total);
        if (consensus.total > 1) {
            sourceTag = "consensus";
        } else if (consensus.total == 1) {
            sourceTag = "single";
        } else {
            sourceTag = "none";
        }

        if (!consensus.hasValue) {
            return hasStable ? stableValue : 0;
        }

        if (consensus.value == lastCandidate) {
            streak++;
        } else {
            lastCandidate = consensus.value;
            streak = 1;
        }

        if (streak >= stabilizeTicks) {
            stableValue = consensus.value;
            hasStable = true;
            lastStableMs = nowMs;
            updatedThisTick = true;
        }

        return hasStable ? stableValue : 0;
    }
};
}

class MCCPlayerCountConsole {
public:
    MCCPlayerCountConsole()
        : mapSignal(kMapStabilizeTicks),
          modeSignal(kModeStabilizeTicks),
          playerSignal(kPlayerStabilizeTicks) {
        InitializeAddresses();
    }

    bool Initialize() {
        LaunchOverlayIfNeeded();
        UpdateProcessState();
        std::cout << "MCC Player Count Console running. Press ESC to exit." << std::endl;
        return true;
    }

    void Run() {
        const bool debugMode = StringEqualsIgnoreCase(GetEnvVar("HMCC_READER_DEBUG"), "1");
        uint64_t sequence = 0;
        uint64_t nextTick = NowSteadyMs();
        while (true) {
            if (GetAsyncKeyState(VK_ESCAPE) & 0x8000) {
                break;
            }

            ProcessEvent evt = UpdateProcessState();
            if (evt.type == ProcessEventType::Started || evt.type == ProcessEventType::Changed) {
                FocusGameWindow();
            }

            int playerCount = 0;
            std::string mapName = "Unknown";
            std::string modeName = "Unknown";
            bool inMenus = true;

            ReadDebug tickDebug;
            if (connected) {
                playerCount = playerSignal.Update(ReadPlayerCandidates(&tickDebug));
                mapName = mapSignal.Update(ReadMapCandidates(&tickDebug));
                modeName = modeSignal.Update(ReadModeCandidates(mapName, &tickDebug));
                inMenus = IsInMenus(playerCount);
            } else {
                mapSignal.Reset();
                modeSignal.Reset();
                playerSignal.Reset();
                inMenus = true;
            }

            std::string status = BuildStatus(playerCount, inMenus, connected);
            WriteTelemetrySnapshot(++sequence, playerCount, mapName, modeName, inMenus, status, tickDebug, debugMode);

            std::string line = "Players: " + std::to_string(playerCount)
                               + " | Map: " + mapName
                               + " | Mode: " + modeName
                               + " | " + status;

            if (line.size() < lastLineWidth) {
                line.append(lastLineWidth - line.size(), ' ');
            } else {
                lastLineWidth = line.size();
            }

            std::cout << '\r' << line << std::flush;

            const uint64_t nowMs = NowSteadyMs();
            nextTick += static_cast<uint64_t>(kPollIntervalMs);
            if (nextTick <= nowMs) {
                // Drift correction if the loop was stalled.
                nextTick = nowMs + static_cast<uint64_t>(kPollIntervalMs);
            }
            const uint64_t sleepMs = nextTick - nowMs;
            std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(sleepMs)));
        }

        std::cout << std::endl;
    }

private:
    HWND gameWindow = nullptr;
    HANDLE processHandle = nullptr;
    DWORD processId = 0;
    bool connected = false;
    size_t lastLineWidth = 0;
    std::string telemetryPath;

    std::vector<uintptr_t> candidateAddresses;
    uintptr_t mccBase = 0;
    uintptr_t haloReachBase = 0;

    StringSignal mapSignal;
    StringSignal modeSignal;
    IntSignal playerSignal;

    struct ReadAttempt {
        std::string label;
        uintptr_t address = 0;
        bool ok = false;
        size_t bytesRead = 0;
        std::string value;
    };

    struct ReadDebug {
        bool connected = false;
        DWORD pid = 0;
        uintptr_t mccBase = 0;
        uintptr_t reachBase = 0;
        std::vector<ReadAttempt> attempts;
        std::string lastError;
    };

    static bool StringEqualsIgnoreCase(const std::string& a, const std::string& b) {
        if (a.size() != b.size()) return false;
        for (size_t i = 0; i < a.size(); i++) {
            if (std::tolower(static_cast<unsigned char>(a[i])) != std::tolower(static_cast<unsigned char>(b[i]))) {
                return false;
            }
        }
        return true;
    }

    void LaunchOverlayIfNeeded() {
        CloseExistingOverlay();
        if (FindWindowA(nullptr, "Customs on the Ring")) {
            return;
        }

        const std::string overlayExe = GetEnvVar("HMCC_OVERLAY_EXE");
        if (!overlayExe.empty()) {
            SpawnProcess(overlayExe, "");
            return;
        }

        const std::string electronPath = ResolveElectronPath();
        const std::string appPath = ResolveOverlayAppPath();
        if (electronPath.empty() || appPath.empty()) {
            return;
        }

        const std::string args = "\"" + electronPath + "\" \"" + appPath + "\"";
        SpawnProcess(electronPath, args, appPath);
    }

    void CloseExistingOverlay() {
        HWND overlay = FindWindowA(nullptr, "Customs on the Ring");
        if (!overlay) {
            return;
        }

        DWORD pid = 0;
        GetWindowThreadProcessId(overlay, &pid);
        if (pid == 0) {
            return;
        }

        PostMessageA(overlay, WM_CLOSE, 0, 0);
        Sleep(200);

        overlay = FindWindowA(nullptr, "Customs on the Ring");
        if (!overlay) {
            return;
        }

        HANDLE proc = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
        if (proc) {
            TerminateProcess(proc, 0);
            CloseHandle(proc);
        }
    }

    std::string ResolveOverlayAppPath() {
        const std::string env = GetEnvVar("HMCC_OVERLAY_APP");
        if (!env.empty()) {
            return env;
        }

        const auto root = ResolveRepoRoot();
        if (root.empty()) {
            return "";
        }
        const auto appPath = root / "pc-app";
        if (std::filesystem::exists(appPath)) {
            return appPath.string();
        }
        return "";
    }

    std::string ResolveElectronPath() {
        const std::string env = GetEnvVar("HMCC_ELECTRON_PATH");
        if (!env.empty()) {
            return env;
        }

        const auto root = ResolveRepoRoot();
        if (root.empty()) {
            return "";
        }
        const auto electronPath =
            root / "pc-app" / "node_modules" / "electron" / "dist" / "electron.exe";
        if (std::filesystem::exists(electronPath)) {
            return electronPath.string();
        }
        return "";
    }

    std::filesystem::path ResolveRepoRoot() {
        char buffer[MAX_PATH] = {};
        DWORD size = GetModuleFileNameA(nullptr, buffer, MAX_PATH);
        if (size == 0 || size >= MAX_PATH) {
            return {};
        }
        std::filesystem::path exePath(buffer);
        auto dir = exePath.parent_path();
        if (dir.empty()) {
            return {};
        }
        dir = dir.parent_path();
        dir = dir.parent_path();
        dir = dir.parent_path();
        return dir;
    }

    std::string GetEnvVar(const char* name) {
        if (!name || !*name) {
            return "";
        }
        char buffer[MAX_PATH] = {};
        DWORD size = GetEnvironmentVariableA(name, buffer, MAX_PATH);
        if (size > 0 && size < MAX_PATH) {
            return std::string(buffer);
        }
        return "";
    }

    void SpawnProcess(const std::string& exePath, const std::string& args, const std::string& workingDir = "") {
        if (exePath.empty()) {
            return;
        }
        STARTUPINFOA si = {};
        PROCESS_INFORMATION pi = {};
        si.cb = sizeof(si);

        std::string commandLine = args.empty() ? ("\"" + exePath + "\"") : args;
        std::vector<char> cmdBuffer(commandLine.begin(), commandLine.end());
        cmdBuffer.push_back('\0');

        BOOL created = CreateProcessA(
            nullptr,
            cmdBuffer.data(),
            nullptr,
            nullptr,
            FALSE,
            CREATE_NO_WINDOW | DETACHED_PROCESS,
            nullptr,
            workingDir.empty() ? nullptr : workingDir.c_str(),
            &si,
            &pi
        );

        if (created) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }

    void InitializeAddresses() {
        // Legacy absolute addresses are session-specific and produce false positives.
        // Keep runtime acquisition module-relative only.
        candidateAddresses.clear();

    }

    ProcessEvent UpdateProcessState() {
        DWORD pid = FindMccProcessId();
        if (pid == 0) {
            if (connected) {
                DisconnectProcess();
                return { ProcessEventType::Stopped, 0 };
            }
            return {};
        }

        if (!connected) {
            if (ConnectToProcess(pid)) {
                return { ProcessEventType::Started, pid };
            }
            return {};
        }

        if (pid != processId) {
            DisconnectProcess();
            if (ConnectToProcess(pid)) {
                return { ProcessEventType::Changed, pid };
            }
        }

        return { ProcessEventType::None, pid };
    }

    DWORD FindMccProcessId() {
        HWND window = FindWindowA(nullptr, "Halo: The Master Chief Collection");
        if (window) {
            DWORD pid = 0;
            GetWindowThreadProcessId(window, &pid);
            if (pid != 0) {
                return pid;
            }
        }

        DWORD pid = FindProcessIdByName("MCC-Win64-Shipping.exe");
        if (pid == 0) {
            pid = FindProcessIdByName("MCC-Win64-Shipping");
        }
        return pid;
    }

    bool ConnectToProcess(DWORD pid) {
        processId = pid;
        gameWindow = FindTopLevelWindowForProcess(pid);
        processHandle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
        connected = processHandle != nullptr;
        ResetSessionState();
        return connected;
    }

    void DisconnectProcess() {
        if (processHandle) {
            CloseHandle(processHandle);
            processHandle = nullptr;
        }
        connected = false;
        processId = 0;
        gameWindow = nullptr;
        ResetSessionState();
    }

    void ResetSessionState() {
        mccBase = 0;
        haloReachBase = 0;
        mapSignal.Reset();
        modeSignal.Reset();
        playerSignal.Reset();
    }

    void FocusGameWindow() {
        if (!gameWindow) {
            return;
        }
        ShowWindow(gameWindow, SW_RESTORE);
        SetForegroundWindow(gameWindow);
        BringWindowToTop(gameWindow);
    }

    DWORD FindProcessIdByName(const char* exeName) {
        if (!exeName || !*exeName) {
            return 0;
        }

        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == INVALID_HANDLE_VALUE) {
            return 0;
        }

        PROCESSENTRY32 entry = {};
        entry.dwSize = sizeof(entry);

        if (Process32First(snapshot, &entry)) {
            do {
                if (_stricmp(entry.szExeFile, exeName) == 0) {
                    CloseHandle(snapshot);
                    return entry.th32ProcessID;
                }
            } while (Process32Next(snapshot, &entry));
        }

        CloseHandle(snapshot);
        return 0;
    }

    struct WindowSearch {
        DWORD pid = 0;
        HWND window = nullptr;
    };

    static BOOL CALLBACK EnumWindowsForProcess(HWND hWnd, LPARAM lParam) {
        auto* state = reinterpret_cast<WindowSearch*>(lParam);
        DWORD windowPid = 0;
        GetWindowThreadProcessId(hWnd, &windowPid);
        if (windowPid != state->pid) {
            return TRUE;
        }

        if (!IsWindowVisible(hWnd)) {
            return TRUE;
        }

        int length = GetWindowTextLengthA(hWnd);
        if (length <= 0) {
            return TRUE;
        }

        state->window = hWnd;
        return FALSE;
    }

    HWND FindTopLevelWindowForProcess(DWORD pid) {
        WindowSearch state;
        state.pid = pid;
        EnumWindows(EnumWindowsForProcess, reinterpret_cast<LPARAM>(&state));
        return state.window;
    }

    void EnsureModuleBases() {
        if (mccBase != 0 && haloReachBase != 0) {
            return;
        }
        if (!connected || processId == 0) {
            return;
        }
        if (mccBase == 0) {
            mccBase = GetRemoteModuleBase("mcc-win64-shipping.exe");
        }
        if (haloReachBase == 0) {
            haloReachBase = GetRemoteModuleBase("haloreach.dll");
        }
    }

    uintptr_t GetRemoteModuleBase(const char* moduleName) {
        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, processId);
        if (snapshot == INVALID_HANDLE_VALUE) {
            return 0;
        }

        MODULEENTRY32 entry = {};
        entry.dwSize = sizeof(entry);

        if (Module32First(snapshot, &entry)) {
            do {
                if (_stricmp(entry.szModule, moduleName) == 0) {
                    CloseHandle(snapshot);
                    return reinterpret_cast<uintptr_t>(entry.modBaseAddr);
                }
            } while (Module32Next(snapshot, &entry));
        }

        CloseHandle(snapshot);
        return 0;
    }

    std::vector<int> ReadPlayerCandidates(ReadDebug* out_debug) {
        std::vector<int> values;
        if (!connected) {
            return values;
        }

        EnsureModuleBases();
        if (out_debug) {
            out_debug->connected = connected;
            out_debug->pid = processId;
            out_debug->mccBase = mccBase;
            out_debug->reachBase = haloReachBase;
        }
        values.reserve(4);

        if (mccBase != 0) {
            int value = 0;
            if (TryReadMemory("players.mcc", mccBase + 0x3F92E10, &value, out_debug) &&
                value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
        }

        if (haloReachBase != 0) {
            int value = 0;
            if (TryReadMemory("players.reach.0", haloReachBase + 0x2B07470, &value, out_debug) &&
                value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
            if (TryReadMemory("players.reach.1", haloReachBase + 0x2B08B50, &value, out_debug) &&
                value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
            if (TryReadMemory("players.reach.2", haloReachBase + 0x2C996A0, &value, out_debug) &&
                value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
        }

        return values;
    }

    std::vector<std::string> ReadMapCandidates(ReadDebug* out_debug) {
        std::vector<std::string> names;
        if (!connected) {
            return names;
        }
        names.reserve(1);

        EnsureModuleBases();
        if (mccBase != 0) {
            uintptr_t basePtr = 0;
            if (TryReadMemory("shared.base", mccBase + kSharedTelemetryBaseOffset, &basePtr, out_debug) &&
                basePtr != 0) {
                std::string name;
                if (TryReadString("map", basePtr + kMapNameOffset, &name, 64, out_debug)) {
                    name = TrimCopy(name);
                    if (IsLikelyMapName(name)) {
                        names.push_back(name);
                    }
                }
            }
        }

        return names;
    }

    std::vector<std::string> ReadModeCandidates(const std::string& mapName, ReadDebug* out_debug) {
        std::vector<std::string> modes;
        if (!connected) {
            return modes;
        }
        modes.reserve(2);

        EnsureModuleBases();
        if (mccBase != 0) {
            uintptr_t basePtr = 0;
            if (TryReadMemory("shared.base", mccBase + kSharedTelemetryBaseOffset, &basePtr, out_debug) &&
                basePtr != 0) {
                for (uintptr_t offset : {kModeNameOffsetPrimary, kModeNameOffsetSecondary}) {
                    std::string mode;
                    const char* label = offset == kModeNameOffsetPrimary ? "mode.prim" : "mode.sec";
                    if (!TryReadString(label, basePtr + offset, &mode, 64, out_debug)) {
                        continue;
                    }
                    mode = TrimCopy(mode);
                    if (!IsLikelyGameMode(mode)) {
                        continue;
                    }
                    if (!mapName.empty() && mapName != "Unknown" && mode == mapName) {
                        continue;
                    }
                    if (std::find(modes.begin(), modes.end(), mode) == modes.end()) {
                        modes.push_back(mode);
                    }
                }
            }
        }

        return modes;
    }

    template<typename T>
    bool TryReadMemory(const char* label, uintptr_t address, T* out_value, ReadDebug* out_debug) {
        if (!processHandle || !out_value) {
            return false;
        }
        SIZE_T bytesRead = 0;
        if (ReadProcessMemory(processHandle, reinterpret_cast<LPCVOID>(address), out_value, sizeof(T), &bytesRead)) {
            const bool ok = bytesRead == sizeof(T);
            if (out_debug) {
                ReadAttempt attempt;
                attempt.label = label ? label : "mem";
                attempt.address = address;
                attempt.ok = ok;
                attempt.bytesRead = bytesRead;
                out_debug->attempts.push_back(std::move(attempt));
            }
            return ok;
        }
        if (out_debug) {
            ReadAttempt attempt;
            attempt.label = label ? label : "mem";
            attempt.address = address;
            attempt.ok = false;
            attempt.bytesRead = bytesRead;
            out_debug->attempts.push_back(std::move(attempt));
        }
        return false;
    }

    bool TryReadStringUtf8(uintptr_t address, std::string* out_value, size_t maxLength, size_t* out_bytes_read) {
        if (!processHandle || !out_value || maxLength == 0) {
            return false;
        }

        std::vector<char> buffer(maxLength + 1, 0);
        SIZE_T bytesRead = 0;
        if (!ReadProcessMemory(processHandle, reinterpret_cast<LPCVOID>(address), buffer.data(), maxLength, &bytesRead)) {
            return false;
        }

        if (out_bytes_read) *out_bytes_read = static_cast<size_t>(bytesRead);
        buffer[maxLength] = '\0';
        size_t length = strnlen_s(buffer.data(), maxLength);
        if (length == 0) {
            out_value->clear();
            return true;
        }

        out_value->assign(buffer.data(), length);
        return true;
    }

    bool TryReadStringUtf16(uintptr_t address, std::string* out_value, size_t maxChars, size_t* out_bytes_read) {
        if (!processHandle || !out_value || maxChars == 0) {
            return false;
        }

        std::vector<wchar_t> buffer(maxChars + 1, 0);
        SIZE_T bytesRead = 0;
        const size_t bytesToRead = maxChars * sizeof(wchar_t);
        if (!ReadProcessMemory(processHandle, reinterpret_cast<LPCVOID>(address), buffer.data(), bytesToRead, &bytesRead)) {
            return false;
        }

        if (out_bytes_read) *out_bytes_read = static_cast<size_t>(bytesRead);
        buffer[maxChars] = L'\0';
        size_t length = 0;
        while (length < maxChars && buffer[length] != L'\0') {
            length++;
        }
        if (length == 0) {
            out_value->clear();
            return true;
        }

        int needed = WideCharToMultiByte(CP_UTF8, 0, buffer.data(), static_cast<int>(length), nullptr, 0, nullptr, nullptr);
        if (needed <= 0) {
            return false;
        }
        std::string utf8;
        utf8.resize(static_cast<size_t>(needed));
        WideCharToMultiByte(CP_UTF8, 0, buffer.data(), static_cast<int>(length), utf8.data(), needed, nullptr, nullptr);
        *out_value = utf8;
        return true;
    }

    bool TryReadString(const char* label, uintptr_t address, std::string* out_value, size_t maxLength, ReadDebug* out_debug) {
        if (!processHandle || !out_value || maxLength == 0) {
            return false;
        }

        size_t bytesRead = 0;
        std::string value;

        bool ok = TryReadStringUtf8(address, &value, maxLength, &bytesRead);
        if (ok) {
            // Heuristic: if it looks like UTF-16LE bytes (lots of zeros), try UTF-16.
            int zeroCount = 0;
            for (size_t i = 1; i < std::min(bytesRead, static_cast<size_t>(32)); i += 2) {
                if (reinterpret_cast<const unsigned char*>(value.data())[i] == 0) {
                    zeroCount++;
                }
            }
            if (zeroCount >= 6) {
                std::string utf16;
                size_t bytesRead16 = 0;
                if (TryReadStringUtf16(address, &utf16, maxLength, &bytesRead16)) {
                    value = utf16;
                    bytesRead = bytesRead16;
                }
            }
            *out_value = value;
        }

        if (out_debug) {
            ReadAttempt attempt;
            attempt.label = label ? label : "str";
            attempt.address = address;
            attempt.ok = ok;
            attempt.bytesRead = bytesRead;
            attempt.value = ok ? value : "";
            out_debug->attempts.push_back(std::move(attempt));
        }

        return ok;
    }

    std::string ResolveTelemetryPath() {
        char buffer[MAX_PATH] = {};
        DWORD size = GetEnvironmentVariableA("MCC_TELEMETRY_OUT", buffer, MAX_PATH);
        if (size > 0 && size < MAX_PATH) {
            return std::string(buffer);
        }

        size = GetEnvironmentVariableA("APPDATA", buffer, MAX_PATH);
        if (size > 0 && size < MAX_PATH) {
            std::string dir = std::string(buffer) + "\\MCC";
            CreateDirectoryA(dir.c_str(), nullptr);
            return dir + "\\customs_state.json";
        }

        return "customs_state.json";
    }

    std::string EscapeJson(const std::string& input) {
        std::ostringstream out;
        for (char c : input) {
            switch (c) {
                case '\\':
                    out << "\\\\";
                    break;
                case '"':
                    out << "\\\"";
                    break;
                case '\n':
                    out << "\\n";
                    break;
                case '\r':
                    out << "\\r";
                    break;
                case '\t':
                    out << "\\t";
                    break;
                default:
                    out << c;
                    break;
            }
        }
        return out.str();
    }

    bool IsLikelyMapName(const std::string& name) const {
        if (name.empty() || name.size() > 64) {
            return false;
        }

        bool hasAlpha = false;
        for (char c : name) {
            unsigned char uc = static_cast<unsigned char>(c);
            if (std::isalnum(uc)) {
                if (std::isalpha(uc)) {
                    hasAlpha = true;
                }
                continue;
            }
            if (c == '_' || c == '-' || c == ' ') {
                continue;
            }
            if (uc >= 32 && uc <= 126) {
                continue;
            }
            return false;
        }

        if (!hasAlpha) {
            return false;
        }
        if (!kUseMapWhitelist) {
            return true;
        }
        return IsReachMapName(name);
    }

    bool IsLikelyGameMode(const std::string& mode) const {
        if (mode.empty() || mode.size() > 64) {
            return false;
        }

        bool hasAlpha = false;
        for (char c : mode) {
            unsigned char uc = static_cast<unsigned char>(c);
            if (std::isalnum(uc)) {
                if (std::isalpha(uc)) {
                    hasAlpha = true;
                }
                continue;
            }
            if (c == '_' || c == '-' || c == ' ') {
                continue;
            }
            if (uc >= 32 && uc <= 126) {
                continue;
            }
            return false;
        }

        return hasAlpha;
    }

    static std::string NormalizeMapName(const std::string& name) {
        std::string out;
        out.reserve(name.size());
        for (char c : name) {
            if (std::isalnum(static_cast<unsigned char>(c))) {
                out.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
            }
        }
        return out;
    }

    static bool IsReachMapName(const std::string& name) {
        static const std::vector<std::string> kReachMaps = {
            "Boardwalk",
            "Boneyard",
            "Countdown",
            "Powerhouse",
            "Reflection",
            "Spire",
            "Sword Base",
            "Zealot",
            "Forge World",
            "Asylum",
            "Hemorrhage",
            "Paradiso",
            "Pinnacle",
            "The Cage",
            "Anchor 9",
            "Breakpoint",
            "Tempest",
            "Condemned",
            "Highlands",
            "Battle Canyon",
            "Breakneck",
            "High Noon",
            "Penance",
            "Ridgeline",
            "Solitary"
        };

        const std::string normalized = NormalizeMapName(name);
        for (const auto& entry : kReachMaps) {
            if (NormalizeMapName(entry) == normalized) {
                return true;
            }
        }
        return false;
    }

    bool IsInMenus(int playerCount) const {
        return playerCount <= 0;
    }

    std::string BuildStatus(int playerCount, bool inMenus, bool isConnected) const {
        if (!isConnected) {
            return "Disconnected";
        }
        if (inMenus) {
            return "Lobby in menus";
        }
        if (playerCount <= 1) {
            return "Waiting for players";
        }
        return "Game ready";
    }

    std::string ComputeSourceTag() const {
        if (mapSignal.sourceTag == "consensus" || modeSignal.sourceTag == "consensus" || playerSignal.sourceTag == "consensus") {
            return "consensus";
        }
        if (mapSignal.sourceTag == "single" || modeSignal.sourceTag == "single" || playerSignal.sourceTag == "single") {
            return "single";
        }
        return "none";
    }

    void WriteTelemetrySnapshot(
        uint64_t seq,
        int playerCount,
        const std::string& mapName,
        const std::string& modeName,
        bool inMenus,
        const std::string& status,
        const ReadDebug& debug,
        bool debugMode
    ) {
        if (telemetryPath.empty()) {
            telemetryPath = ResolveTelemetryPath();
            std::cout << "\nWriting telemetry to: " << telemetryPath << std::endl;
        }

        const bool hasMap = !mapName.empty() && mapName != "Unknown";
        const bool hasMode = !modeName.empty() && modeName != "Unknown";
        const bool isCustomGame = connected && hasMap && !inMenus;
        const auto now = std::chrono::system_clock::now();
        const auto epochMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        std::ostringstream payload;
        payload << "{";
        payload << "\"seq\":" << seq << ",";
        payload << "\"ts\":" << epochMs << ",";
        payload << "\"pid\":" << processId << ",";
        payload << "\"sessionId\":\"\",";
        payload << "\"connected\":" << (connected ? "true" : "false") << ",";
        payload << "\"inMenus\":" << (inMenus ? "true" : "false") << ",";
        payload << "\"mapName\":\"" << EscapeJson(mapName) << "\",";
        payload << "\"modeName\":\"" << EscapeJson(modeName) << "\",";
        payload << "\"playerCount\":" << playerCount << ",";
        payload << "\"mapUpdatedThisTick\":" << (mapSignal.updatedThisTick ? "true" : "false") << ",";
        payload << "\"modeUpdatedThisTick\":" << (modeSignal.updatedThisTick ? "true" : "false") << ",";
        payload << "\"playersUpdatedThisTick\":" << (playerSignal.updatedThisTick ? "true" : "false") << ",";
        payload << "\"confidence\":{"
                << "\"map\":" << std::fixed << std::setprecision(2) << mapSignal.confidence << ","
                << "\"mode\":" << std::fixed << std::setprecision(2) << modeSignal.confidence << ","
                << "\"players\":" << std::fixed << std::setprecision(2) << playerSignal.confidence
                << "},";
        payload << "\"status\":\"" << EscapeJson(status) << "\",";
        payload << "\"sourceTag\":\"" << EscapeJson(ComputeSourceTag()) << "\",";
        payload << "\"isCustomGame\":" << (isCustomGame ? "true" : "false") << ",";
        payload << "\"gameMode\":\"" << EscapeJson(modeName) << "\"";

        if (debugMode) {
            payload << ",";
            payload << "\"debug\":{";
            payload << "\"tick\":\"" << EscapeJson(TimestampNow()) << "\",";
            payload << "\"pollMs\":" << kPollIntervalMs << ",";
            payload << "\"handleOk\":" << (processHandle ? "true" : "false") << ",";
            payload << "\"mapAgeMs\":"
                    << (mapSignal.lastStableMs == 0 ? -1LL : static_cast<long long>(NowSteadyMs() - mapSignal.lastStableMs))
                    << ",";
            payload << "\"modeAgeMs\":"
                    << (modeSignal.lastStableMs == 0 ? -1LL : static_cast<long long>(NowSteadyMs() - modeSignal.lastStableMs))
                    << ",";
            payload << "\"mapUpdatedThisTick\":" << (mapSignal.updatedThisTick ? "true" : "false") << ",";
            payload << "\"modeUpdatedThisTick\":" << (modeSignal.updatedThisTick ? "true" : "false") << ",";
            payload << "\"playersUpdatedThisTick\":" << (playerSignal.updatedThisTick ? "true" : "false") << ",";
            payload << "\"mccBase\":" << static_cast<unsigned long long>(debug.mccBase) << ",";
            payload << "\"reachBase\":" << static_cast<unsigned long long>(debug.reachBase) << ",";
            payload << "\"attempts\":[";
            for (size_t i = 0; i < debug.attempts.size(); i++) {
                const auto& a = debug.attempts[i];
                if (i > 0) payload << ",";
                payload << "{";
                payload << "\"label\":\"" << EscapeJson(a.label) << "\",";
                payload << "\"addr\":" << static_cast<unsigned long long>(a.address) << ",";
                payload << "\"ok\":" << (a.ok ? "true" : "false") << ",";
                payload << "\"bytes\":" << static_cast<unsigned long long>(a.bytesRead);
                if (!a.value.empty()) {
                    payload << ",\"value\":\"" << EscapeJson(a.value) << "\"";
                }
                payload << "}";
            }
            payload << "]";
            payload << "}";
        }
        payload << "}";

        const bool readerDebug = debugMode || IsReaderDebugEnabled();
        std::filesystem::path targetPath(telemetryPath);
        std::filesystem::path tmpPath = targetPath;
        tmpPath += ".tmp";

        {
            std::ofstream out(tmpPath, std::ios::binary | std::ios::trunc);
            if (!out.is_open()) {
                if (readerDebug) {
                    std::cerr << "\n[reader] telemetry write failed: open tmp failed path="
                              << tmpPath.string() << std::endl;
                }
                return;
            }

            out << "{\"version\":\"1.0\",\"data\":" << payload.str() << "}";
            out.flush();
            if (!out.good()) {
                if (readerDebug) {
                    std::cerr << "\n[reader] telemetry write failed: write/flush failed tmp="
                              << tmpPath.string() << std::endl;
                }
                return;
            }
        }

        // Atomically replace the target file to avoid torn reads/zero-byte windows.
        const std::wstring tmpW = tmpPath.wstring();
        const std::wstring targetW = targetPath.wstring();
        if (!MoveFileExW(
                tmpW.c_str(),
                targetW.c_str(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
            )) {
            const DWORD err = GetLastError();
            if (readerDebug) {
                std::cerr << "\n[reader] telemetry write failed: MoveFileExW("
                          << tmpPath.string() << " -> " << targetPath.string()
                          << ") err=" << err << " msg=" << FormatWin32ErrorMessage(err)
                          << std::endl;
            }
            // Best-effort cleanup of tmp if replace failed.
            std::error_code ec;
            std::filesystem::remove(tmpPath, ec);
        }
    }
};

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    MCCPlayerCountConsole console;

    if (!console.Initialize()) {
        return 1;
    }

    console.Run();
    return 0;
}
