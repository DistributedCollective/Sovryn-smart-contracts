pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

contract StakingStorage is Ownable{
    ///@notice 2 weeks in seconds
    uint constant twoWeeks = 1209600;
    
    ///@notice the maximum possible voting weight
    uint96 public constant maxVotingWeight = 100;
    
    /// @notice the maximum duration to stake tokens for
    uint public constant maxDuration = 1095 days;
    
    ///@notice the maximum duration ^2
    uint96 constant maxDurationPow2 = 1095 * 1095;
    
    ///@notice the timestamp of contract creation. base for the staking period calculation
    uint public kickoffTS;
    
    string name = "SOVStaking";
    
    /// @notice the token to be staked
    IERC20 public SOVToken;
    
    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;
    
    /// @notice if this flag is set to true, all tokens are unlocked immediately
    bool allUnlocked = false;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's stake balance changes
    event DelegateStakeChanged(address indexed delegate, uint lockedUntil, uint previousBalance, uint newBalance);

    /// @notice An event thats emitted when tokens get staked
    event TokensStaked(address indexed staker, uint amount, uint lockedUntil, uint totalStaked);
    
    /// @notice An event thats emitted when tokens get withdrawn
    event TokensWithdrawn(address indexed staker, uint amount);
    
    /// @notice An event thats emitted when the owner unlocks all tokens
    event TokensUnlocked(uint amount);
    
    /// @notice An event thats emitted when a staking period gets extended
    event ExtendedStakingDuration(address indexed staker, uint previousDate, uint newDate);
}