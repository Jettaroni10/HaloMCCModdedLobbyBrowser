#include <Windows.h>
#include <TlHelp32.h>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstring>
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
constexpr int kMenuFallbackTicks = 3;
constexpr bool kUseMapWhitelist = true;

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

struct StringSignal {
    int stabilizeTicks = 3;
    int staleTicks = 3;
    std::string stableValue;
    std::string lastCandidate;
    int streak = 0;
    int noValidTicks = 0;
    float confidence = 0.0f;
    std::string sourceTag = "none";

    explicit StringSignal(int stabilize, int stale)
        : stabilizeTicks(stabilize), staleTicks(stale) {}

    void Reset() {
        stableValue.clear();
        lastCandidate.clear();
        streak = 0;
        noValidTicks = 0;
        confidence = 0.0f;
        sourceTag = "none";
    }

    std::string Update(const std::vector<std::string>& candidates) {
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
            noValidTicks++;
            if (noValidTicks >= staleTicks) {
                stableValue = "Unknown";
            }
            return stableValue.empty() ? "Unknown" : stableValue;
        }

        noValidTicks = 0;
        if (consensus.value == lastCandidate) {
            streak++;
        } else {
            lastCandidate = consensus.value;
            streak = 1;
        }

        if (streak >= stabilizeTicks) {
            stableValue = consensus.value;
        }

        return stableValue.empty() ? "Unknown" : stableValue;
    }
};

struct IntSignal {
    int stabilizeTicks = 2;
    int staleTicks = 2;
    int stableValue = 0;
    int lastCandidate = 0;
    int streak = 0;
    int noValidTicks = 0;
    bool hasStable = false;
    float confidence = 0.0f;
    std::string sourceTag = "none";

    explicit IntSignal(int stabilize, int stale)
        : stabilizeTicks(stabilize), staleTicks(stale) {}

    void Reset() {
        stableValue = 0;
        lastCandidate = 0;
        streak = 0;
        noValidTicks = 0;
        hasStable = false;
        confidence = 0.0f;
        sourceTag = "none";
    }

    int Update(const std::vector<int>& candidates) {
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
            noValidTicks++;
            if (noValidTicks >= staleTicks) {
                hasStable = false;
                stableValue = 0;
            }
            return hasStable ? stableValue : 0;
        }

        noValidTicks = 0;
        if (consensus.value == lastCandidate) {
            streak++;
        } else {
            lastCandidate = consensus.value;
            streak = 1;
        }

        if (streak >= stabilizeTicks) {
            stableValue = consensus.value;
            hasStable = true;
        }

        return hasStable ? stableValue : 0;
    }
};
}

class MCCPlayerCountConsole {
public:
    MCCPlayerCountConsole()
        : mapSignal(kMapStabilizeTicks, kMenuFallbackTicks),
          modeSignal(kModeStabilizeTicks, kMenuFallbackTicks),
          playerSignal(kPlayerStabilizeTicks, kPlayerStabilizeTicks) {
        InitializeAddresses();
    }

    bool Initialize() {
        LaunchOverlayIfNeeded();
        UpdateProcessState();
        std::cout << "MCC Player Count Console running. Press ESC to exit." << std::endl;
        return true;
    }

    void Run() {
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

            if (connected) {
                playerCount = playerSignal.Update(ReadPlayerCandidates());
                mapName = mapSignal.Update(ReadMapCandidates());
                modeName = modeSignal.Update(ReadModeCandidates(mapName));
                inMenus = IsInMenus(playerCount);
            } else {
                mapSignal.Reset();
                modeSignal.Reset();
                playerSignal.Reset();
                inMenus = true;
            }

            std::string status = BuildStatus(playerCount, inMenus, connected);
            WriteTelemetrySnapshot(playerCount, mapName, modeName, inMenus, status);

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

            std::this_thread::sleep_for(std::chrono::milliseconds(200));
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
        candidateAddresses = {
            0x1CDCAFFA6F8,
            0x1CDDF517EF8,
            0x7FF3C7433EEC,
            0x7FF3C78D3EEC,
            0x7FF3C7D63EEC
        };

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

    std::vector<int> ReadPlayerCandidates() {
        std::vector<int> values;
        if (!connected) {
            return values;
        }

        EnsureModuleBases();
        values.reserve(candidateAddresses.size() + 4);

        for (uintptr_t address : candidateAddresses) {
            int value = 0;
            if (TryReadMemory(address, &value) && value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
        }

        if (mccBase != 0) {
            int value = 0;
            if (TryReadMemory(mccBase + 0x3F92E10, &value) && value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
        }

        if (haloReachBase != 0) {
            int value = 0;
            if (TryReadMemory(haloReachBase + 0x2B07470, &value) && value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
            if (TryReadMemory(haloReachBase + 0x2B08B50, &value) && value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
            if (TryReadMemory(haloReachBase + 0x2C996A0, &value) && value >= 0 && value <= kMaxPlayers) {
                values.push_back(value);
            }
        }

        return values;
    }

    std::vector<std::string> ReadMapCandidates() {
        std::vector<std::string> names;
        if (!connected) {
            return names;
        }
        names.reserve(1);

        EnsureModuleBases();
        if (mccBase != 0) {
            uintptr_t basePtr = 0;
            if (TryReadMemory(mccBase + 0x4001590, &basePtr) && basePtr != 0) {
                std::string name;
                if (TryReadString(basePtr + 0x44D, &name, 64) && IsLikelyMapName(name)) {
                    names.push_back(name);
                }
            }
        }

        return names;
    }

    std::vector<std::string> ReadModeCandidates(const std::string& mapName) {
        std::vector<std::string> modes;
        if (!connected) {
            return modes;
        }
        modes.reserve(1);

        EnsureModuleBases();
        if (mccBase != 0) {
            uintptr_t basePtr = 0;
            if (TryReadMemory(mccBase + 0x4001590, &basePtr) && basePtr != 0) {
                std::string mode;
                if (TryReadString(basePtr + 0x3C4, &mode, 64) && IsLikelyGameMode(mode)) {
                    if (!mapName.empty() && mapName != "Unknown" && mode == mapName) {
                        return modes;
                    }
                    modes.push_back(mode);
                }
            }
        }

        return modes;
    }

    template<typename T>
    bool TryReadMemory(uintptr_t address, T* out_value) {
        if (!processHandle || !out_value) {
            return false;
        }
        SIZE_T bytesRead = 0;
        if (ReadProcessMemory(processHandle, reinterpret_cast<LPCVOID>(address), out_value, sizeof(T), &bytesRead)) {
            return bytesRead == sizeof(T);
        }
        return false;
    }

    bool TryReadString(uintptr_t address, std::string* out_value, size_t maxLength) {
        if (!processHandle || !out_value || maxLength == 0) {
            return false;
        }

        std::vector<char> buffer(maxLength + 1, 0);
        SIZE_T bytesRead = 0;
        if (!ReadProcessMemory(processHandle, reinterpret_cast<LPCVOID>(address), buffer.data(), maxLength, &bytesRead)) {
            return false;
        }

        buffer[maxLength] = '\0';
        size_t length = strnlen_s(buffer.data(), maxLength);
        if (length == 0) {
            out_value->clear();
            return true;
        }

        out_value->assign(buffer.data(), length);
        return true;
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

    void WriteTelemetrySnapshot(int playerCount, const std::string& mapName, const std::string& modeName, bool inMenus, const std::string& status) {
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
        payload << "\"ts\":" << epochMs << ",";
        payload << "\"pid\":" << processId << ",";
        payload << "\"sessionId\":\"\",";
        payload << "\"connected\":" << (connected ? "true" : "false") << ",";
        payload << "\"inMenus\":" << (inMenus ? "true" : "false") << ",";
        payload << "\"mapName\":\"" << EscapeJson(mapName) << "\",";
        payload << "\"modeName\":\"" << EscapeJson(modeName) << "\",";
        payload << "\"playerCount\":" << playerCount << ",";
        payload << "\"confidence\":{"
                << "\"map\":" << std::fixed << std::setprecision(2) << mapSignal.confidence << ","
                << "\"mode\":" << std::fixed << std::setprecision(2) << modeSignal.confidence << ","
                << "\"players\":" << std::fixed << std::setprecision(2) << playerSignal.confidence
                << "},";
        payload << "\"status\":\"" << EscapeJson(status) << "\",";
        payload << "\"sourceTag\":\"" << EscapeJson(ComputeSourceTag()) << "\",";
        payload << "\"isCustomGame\":" << (isCustomGame ? "true" : "false") << ",";
        payload << "\"gameMode\":\"" << EscapeJson(modeName) << "\"";
        payload << "}";

        std::ofstream out(telemetryPath, std::ios::binary | std::ios::trunc);
        if (!out.is_open()) {
            return;
        }

        out << "{\"version\":\"1.0\",\"data\":" << payload.str() << "}";
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
