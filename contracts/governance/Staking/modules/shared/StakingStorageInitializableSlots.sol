pragma solidity ^0.5.17;

/**
 * @title Interface for Staking modules governance/Staking/modules
 */

contract StakingStorageInitializableSlots {
    bytes32 internal constant STAKING_KICKOFF_TS_STORAGE_SLOT =
        keccak256("STAKING_KICKOFF_TS_STORAGE_SLOT_MTo3ODc1ODoxNzc4NzM4MjA1OjE3MTQ5NzM0NjU"); // MTo3ODc1ODoxNzc4NzM4MjA1OjE3MTQ5NzM0NjU is a nonce
    bytes32 internal constant SOV_TOKEN_ADDRESS_STORAGE_SLOT =
        keccak256("SOV_TOKEN_ADDRESS_STORAGE_SLOT_MTo3ODc1ODoxNzc4NzM4MjA1OjE3MTQ5NzM0NjU");
}
