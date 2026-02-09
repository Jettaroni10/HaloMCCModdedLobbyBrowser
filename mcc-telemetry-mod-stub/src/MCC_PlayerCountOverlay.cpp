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
constexpr int kStabilizeTicks = 3;
constexpr int kMenuFallbackTicks = 3;
}

class MCCPlayerCountConsole {
public:
    MCCPlayerCountConsole() {
        InitializeAddresses();
    }

    bool Initialize() {
        LaunchOverlayIfNeeded();
        if (!FindGameWindowAndProcess()) {
            std::cout << "MCC window not found!" << std::endl;
            return false;
        }
        FocusGameWindow();

        if (!AttachToGameProcess()) {
            std::cout << "Failed to attach to MCC process!" << std::endl;
            return false;
        }

        std::cout << "MCC Player Count Console running. Press ESC to exit." << std::endl;
        return true;
    }

    void Run() {
        while (true) {
            if (GetAsyncKeyState(VK_ESCAPE) & 0x8000) {
                break;
            }

            int playerCount = DetectPlayerCount();
            std::string mapName = DetectMapName();
            std::string gameMode = DetectGameMode(mapName);
            std::string status = GetGameStatus(playerCount);
            WriteTelemetrySnapshot(playerCount, mapName, gameMode);
            std::string line = "Players: " + std::to_string(playerCount)
                               + " | Map: " + mapName
                               + " | Mode: " + gameMode
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
    size_t lastLineWidth = 0;
    std::string telemetryPath;

    std::vector<uintptr_t> candidateAddresses;
    std::vector<uintptr_t> mapNameAddresses;
    std::vector<uintptr_t> gameModeAddresses;
    uintptr_t mccBase = 0;
    uintptr_t haloReachBase = 0;
    std::string lastMapCandidate;
    std::string stableMapName;
    int mapCandidateStreak = 0;
    int noValidMapTicks = 0;
    std::string lastModeCandidate;
    std::string stableModeName;
    int modeCandidateStreak = 0;
    float lastPlayerConfidence = 0.0f;
    float lastMapConfidence = 0.0f;
    float lastModeConfidence = 0.0f;
    std::string lastSourceTag;

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
        auto dir = exePath.parent_path(); // Release
        if (dir.empty()) {
            return {};
        }
        dir = dir.parent_path(); // build
        dir = dir.parent_path(); // mcc-telemetry-mod-stub
        dir = dir.parent_path(); // repo root
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

        mapNameAddresses = {
            0x2BD8F3FA818,
            0x2BD8F3FA4AD
        };

        gameModeAddresses = {
            0x2BD8F3FA424,
            0x2BD8F3FA918,
            0x2BD8F363870,
            0x2BDABAF3BB0,
            0x2BD8F3FA4AD
        };
    }

    struct ConsensusResult {
        std::string value;
        int total = 0;
        int bestCount = 0;
    };

    bool FindGameWindowAndProcess() {
        gameWindow = FindWindowA(nullptr, "Halo: The Master Chief Collection");
        if (gameWindow) {
            GetWindowThreadProcessId(gameWindow, &processId);
            return processId != 0;
        }

        processId = FindProcessIdByName("MCC-Win64-Shipping.exe");
        if (processId == 0) {
            processId = FindProcessIdByName("MCC-Win64-Shipping");
        }
        if (processId == 0) {
            return false;
        }

        gameWindow = FindTopLevelWindowForProcess(processId);
        return gameWindow != nullptr;
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

    bool AttachToGameProcess() {
        if (!processId) {
            GetWindowThreadProcessId(gameWindow, &processId);
        }
        if (processId == 0) {
            return false;
        }

        processHandle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, processId);
        return processHandle != nullptr;
    }

    int DetectPlayerCount() {
        if (mccBase == 0 || haloReachBase == 0) {
            FindModuleBases();
        }

        std::vector<int> values;
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

        ConsensusResult consensus = GetConsensusValue(values);
        lastPlayerConfidence = CalculateConfidence(consensus);
        lastSourceTag = consensus.total > 1 ? "consensus" : "single";
        return consensus.value.empty() ? 0 : std::stoi(consensus.value);
    }

    std::string DetectMapName() {
        std::vector<std::string> names;
        names.reserve(mapNameAddresses.size());

        for (uintptr_t address : mapNameAddresses) {
            std::string name;
            if (TryReadString(address, &name, 64) && IsLikelyMapName(name)) {
                names.push_back(name);
            }
        }

        ConsensusResult consensus = GetConsensusString(names);
        UpdateStabilizedValue(consensus.value, lastMapCandidate, mapCandidateStreak, stableMapName);
        if (consensus.value.empty()) {
            noValidMapTicks++;
        } else {
            noValidMapTicks = 0;
        }
        lastMapConfidence = CalculateConfidence(consensus);
        if (consensus.total > 1) {
            lastSourceTag = "consensus";
        }

        if (noValidMapTicks >= kMenuFallbackTicks) {
            stableMapName.clear();
            return "Unknown";
        }

        return stableMapName.empty() ? "Unknown" : stableMapName;
    }

    std::string DetectGameMode(const std::string& mapName) {
        std::vector<std::string> modes;
        modes.reserve(gameModeAddresses.size());

        for (uintptr_t address : gameModeAddresses) {
            std::string mode;
            if (TryReadString(address, &mode, 64) && IsLikelyGameMode(mode)) {
                if (!mapName.empty() && mode == mapName) {
                    continue;
                }
                modes.push_back(mode);
            }
        }

        ConsensusResult consensus = GetConsensusString(modes);
        UpdateStabilizedValue(consensus.value, lastModeCandidate, modeCandidateStreak, stableModeName);
        lastModeConfidence = CalculateConfidence(consensus);
        if (consensus.total > 1) {
            lastSourceTag = "consensus";
        }
        if (IsInMenus()) {
            return "Unknown";
        }
        return stableModeName.empty() ? "Unknown" : stableModeName;
    }

    std::string GetGameStatus(int playerCount) {
        if (IsInMenus()) {
            return "Lobby in menus";
        }
        if (playerCount == 1) {
            return "Status: Waiting for players";
        }
        if (playerCount >= 2) {
            return "Status: Game ready";
        }

        return "Status: Detecting...";
    }

    void FindModuleBases() {
        mccBase = GetRemoteModuleBase("mcc-win64-shipping.exe");
        haloReachBase = GetRemoteModuleBase("haloreach.dll");
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

    void WriteTelemetrySnapshot(int playerCount, const std::string& mapName, const std::string& modeName) {
        if (telemetryPath.empty()) {
            telemetryPath = ResolveTelemetryPath();
            std::cout << "\nWriting telemetry to: " << telemetryPath << std::endl;
        }

        const bool hasMap = !mapName.empty() && mapName != "Unknown";
        const bool hasMode = !modeName.empty() && modeName != "Unknown";
        const bool isCustomGame = hasMap && hasMode;
        const bool connected = processHandle != nullptr;
        const bool inMenus = IsInMenus();
        const float confidence = CalculateOverallConfidence();
        const auto now = std::chrono::system_clock::now();
        const auto epochMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

        std::ostringstream payload;
        payload << "{";
        payload << "\"ts\":" << epochMs << ",";
        payload << "\"pid\":" << processId << ",";
        payload << "\"connected\":" << (connected ? "true" : "false") << ",";
        payload << "\"inMenus\":" << (inMenus ? "true" : "false") << ",";
        payload << "\"isCustomGame\":" << (isCustomGame ? "true" : "false") << ",";
        payload << "\"mapName\":\"" << EscapeJson(mapName) << "\",";
        payload << "\"modeName\":\"" << EscapeJson(modeName) << "\",";
        payload << "\"gameMode\":\"" << EscapeJson(modeName) << "\",";
        payload << "\"playerCount\":" << playerCount << ",";
        payload << "\"maxPlayers\":0,";
        payload << "\"hostName\":\"\",";
        payload << "\"mods\":[],";
        payload << "\"confidence\":" << std::fixed << std::setprecision(2) << confidence << ",";
        payload << "\"sourceTag\":\"" << EscapeJson(lastSourceTag) << "\"";
        payload << "}";

        std::ofstream out(telemetryPath, std::ios::binary | std::ios::trunc);
        if (!out.is_open()) {
            return;
        }

        out << "{\"version\":\"1.0\",\"data\":" << payload.str() << "}";
    }

    bool IsLikelyMapName(const std::string& name) {
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

        return hasAlpha && IsReachMapName(name);
    }

    bool IsLikelyGameMode(const std::string& mode) {
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

    ConsensusResult GetConsensusValue(const std::vector<int>& values) {
        if (values.empty()) {
            return {};
        }

        std::map<int, int> frequency;
        for (int val : values) {
            frequency[val]++;
        }

        auto mostFrequent = std::max_element(
            frequency.begin(),
            frequency.end(),
            [](const auto& a, const auto& b) { return a.second < b.second; }
        );

        ConsensusResult result;
        result.total = static_cast<int>(values.size());
        result.bestCount = mostFrequent->second;
        result.value = std::to_string(mostFrequent->first);
        return result;
    }

    ConsensusResult GetConsensusString(const std::vector<std::string>& values) {
        if (values.empty()) {
            return {};
        }

        std::map<std::string, int> frequency;
        for (const auto& value : values) {
            frequency[value]++;
        }

        auto mostFrequent = std::max_element(
            frequency.begin(),
            frequency.end(),
            [](const auto& a, const auto& b) { return a.second < b.second; }
        );

        ConsensusResult result;
        result.total = static_cast<int>(values.size());
        result.bestCount = mostFrequent->second;
        result.value = mostFrequent->first;
        return result;
    }

    static float CalculateConfidence(const ConsensusResult& result) {
        if (result.total <= 0 || result.bestCount <= 0) {
            return 0.0f;
        }
        return static_cast<float>(result.bestCount) / static_cast<float>(result.total);
    }

    float CalculateOverallConfidence() const {
        int parts = 0;
        float total = 0.0f;
        if (lastPlayerConfidence > 0.0f) {
            total += lastPlayerConfidence;
            parts++;
        }
        if (lastMapConfidence > 0.0f) {
            total += lastMapConfidence;
            parts++;
        }
        if (lastModeConfidence > 0.0f) {
            total += lastModeConfidence;
            parts++;
        }
        if (parts == 0) {
            return 0.0f;
        }
        return total / static_cast<float>(parts);
    }

    static void UpdateStabilizedValue(
        const std::string& candidate,
        std::string& lastCandidate,
        int& streak,
        std::string& stableValue
    ) {
        if (candidate.empty()) {
            streak = 0;
            lastCandidate.clear();
            return;
        }

        if (candidate == lastCandidate) {
            streak++;
        } else {
            lastCandidate = candidate;
            streak = 1;
        }

        if (streak >= kStabilizeTicks) {
            stableValue = candidate;
        }
    }

    bool IsInMenus() const {
        if (stableMapName.empty() || stableMapName == "Unknown") {
            return true;
        }
        return noValidMapTicks >= kMenuFallbackTicks;
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
};

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    MCCPlayerCountConsole console;

    if (!console.Initialize()) {
        return 1;
    }

    console.Run();
    return 0;
}
