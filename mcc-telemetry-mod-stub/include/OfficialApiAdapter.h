#pragma once

#include "TelemetryContract.h"

namespace mccmod {

class OfficialApiAdapter {
 public:
  bool IsApiAvailable() const;
  bool IsOfflineCustomContext() const;
  bool IsAntiCheatActive() const;
  bool TryReadSnapshot(TelemetrySnapshot* out_snapshot) const;
};

}  // namespace mccmod
