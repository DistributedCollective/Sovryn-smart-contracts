pragma solidity 0.5.17;

import "./LiquidityMiningStorage.sol";

contract LiquidityMiningStorageV1 is LiquidityMiningStorage {
    /// @dev Careful when adding new states as there is a < comparison being used in the modifiers
    enum MigrationGracePeriodStates {
        None,
        Started, // users can withdraw funds and rewards but not deposit
        Finished // users can't operate with the contract
    }

    /// @dev Represents migration grace period state
    MigrationGracePeriodStates public migrationGracePeriodState;

    /// @dev liquidity mining V2 contract address
    address public liquidityMiningV2;
}
