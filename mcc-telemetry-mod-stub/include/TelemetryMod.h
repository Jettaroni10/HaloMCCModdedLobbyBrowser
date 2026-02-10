#pragma once

#include <atomic>
#include <thread>

namespace mccmod {

class TelemetryMod {
 public:
  void Initialize();
  void Shutdown();

 private:
  void WorkerLoop();

  bool initialized_ = false;
  std::atomic<bool> running_{false};
  std::thread worker_;
};

}  // namespace mccmod
