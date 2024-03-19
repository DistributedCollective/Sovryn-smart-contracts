pragma solidity ^0.5.17;

import "../../openzeppelin/Initializable.sol";
import "../../utils/AdminRoleManaged.sol";
import "../../interfaces/IERC20.sol";
import "./IVestingFactory.sol";
import "../../locked/LockedSOV.sol";
import "./IVestingRegistry.sol";

/**
 * @title Vesting Registry Storage Contract.
 *
 * @notice This contract is just the storage required for vesting registry.
 * It is parent of VestingRegistryProxy and VestingRegistry.
 *
 * @dev Use Ownable as a parent to align storage structure for Logic and Proxy contracts.
 * */

contract VestingRegistryStorage is Initializable, AdminRoleManaged {
    ///@notice the vesting factory contract
    IVestingFactory public vestingFactory;

    ///@notice the Locked SOV contract
    ///@dev NOTES: No need to update lockedSOV in this contract, since it might break the vestingRegistry if the new lockedSOV does not have the same value of cliff & duration.
    ILockedSOV public lockedSOV;

    ///@notice the list of vesting registries
    IVestingRegistry[] public vestingRegistries;

    ///@notice the SOV token contract
    address public SOV;

    ///@notice the staking contract address
    address public staking;

    ///@notice fee sharing proxy
    address public feeSharingCollector;

    ///@notice the vesting owner (e.g. governance timelock address)
    address public vestingOwner;

    enum VestingType {
        TeamVesting, //MultisigVesting
        Vesting //TokenHolderVesting
    }

    ///@notice Vesting details
    struct Vesting {
        uint256 vestingType;
        uint256 vestingCreationType;
        address vestingAddress;
    }

    ///@notice A record of vesting details for a unique id
    ///@dev vestings[uid] returns vesting data
    mapping(uint256 => Vesting) public vestings;

    ///@notice A record of all unique ids for a particular token owner
    ///@dev vestingsOf[tokenOwner] returns array of unique ids
    mapping(address => uint256[]) public vestingsOf;

    ///@notice A record of all vesting addresses
    ///@dev isVesting[address] returns if the address is a vesting address
    mapping(address => bool) public isVesting;

    /// @notice Store vesting creation type & vesting type information
    /// @dev it is packed into 1 single storage slot for cheaper gas usage
    struct VestingCreationAndTypeDetails {
        bool isSet;
        uint32 vestingType;
        uint128 vestingCreationType;
    }

    ///@notice A record of all vesting addresses with the detail
    ///@dev vestingDetail[vestingAddress] returns Vesting struct data
    ///@dev can be used to easily check the vesting type / creation type based on the vesting address itself
    mapping(address => VestingCreationAndTypeDetails) public vestingCreationAndTypes;
}
