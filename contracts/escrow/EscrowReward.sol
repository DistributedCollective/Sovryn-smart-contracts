pragma solidity ^0.5.17;

import "./Escrow.sol";
import "../locked/ILockedSOV.sol";

/**
 *  @title A reward distribution contract for Sovryn Ethereum Pool Escrow Contract.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @notice Multisig can use this contract for depositing of Reward tokens based on the total token deposit.
 */
contract EscrowReward is Escrow {
    using SafeMath for uint256;

    /* Storage */

    /// @notice The total reward tokens deposited.
    /// @dev Used for calculating the reward % share of users related to total deposit.
    uint256 public totalRewardDeposit;

    /// @notice The Locked SOV contract.
    ILockedSOV public lockedSOV;

    /* Events */

    /// @notice Emitted when the Locked SOV Contract address is updated.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _lockedSOV The address of the Locked SOV Contract.
    event LockedSOVUpdated(address indexed _initiator, address indexed _lockedSOV);

    /// @notice Emitted when a new reward token deposit is done by Multisig.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _amount The amount of token deposited.
    event RewardDepositByMultisig(address indexed _initiator, uint256 _amount);

    /// @notice Emitted when a Reward token withdraw is done by User.
    /// @param _initiator The address which initiated this event to be emitted.
    /// @param _amount The amount of token withdrawed.
    event RewardTokenWithdraw(address indexed _initiator, uint256 _amount);

    /* Functions */

    /**
     * @notice Setup the required parameters.
     * @param _lockedSOV The Locked SOV Contract address.
     * @param _SOV The SOV token address.
     * @param _multisig The owner of the tokens & contract.
     * @param _releaseTime The token release time, zero if undecided.
     * @param _depositLimit The amount of tokens we will be accepting.
     */
    constructor(
        address _lockedSOV,
        address _SOV,
        address _multisig,
        uint256 _releaseTime,
        uint256 _depositLimit
    ) public Escrow(_SOV, _multisig, _releaseTime, _depositLimit) {
        if (_lockedSOV != address(0)) {
            lockedSOV = ILockedSOV(_lockedSOV);
        }
    }

    /**
     * @notice Set the Locked SOV Contract Address if not already done.
     * @param _lockedSOV The Locked SOV Contract address.
     */
    function updateLockedSOV(address _lockedSOV) external onlyMultisig {
        require(_lockedSOV != address(0), "Invalid Reward Token Address.");

        lockedSOV = ILockedSOV(_lockedSOV);

        emit LockedSOVUpdated(msg.sender, _lockedSOV);
    }

    /**
     * @notice Deposit tokens to this contract by the Multisig.
     * @param _amount the amount of tokens deposited.
     * @dev The contract has to be approved by the multisig inorder for this function to work.
     */
    function depositRewardByMultisig(uint256 _amount) external onlyMultisig {
        require(
            status != Status.Withdraw,
            "Reward Token deposit is only allowed before User Withdraw starts."
        );
        require(_amount > 0, "Amount needs to be bigger than zero.");

        bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
        require(txStatus, "Token transfer was not successful.");

        totalRewardDeposit = totalRewardDeposit.add(_amount);
        txStatus = SOV.approve(address(lockedSOV), totalRewardDeposit);
        require(txStatus, "Token Approval was not successful.");

        emit RewardDepositByMultisig(msg.sender, _amount);
    }

    /**
     * @notice Withdraws token and reward from the contract by User. Reward is gone to lockedSOV contract for future vesting.
     * @dev Only works after the contract state is in Withdraw.
     */
    function withdrawTokensAndReward() external checkRelease checkStatus(Status.Withdraw) {
        // Reward calculation have to be done initially as the User Balance is zeroed out .
        uint256 reward = userBalances[msg.sender].mul(totalRewardDeposit).div(totalDeposit);
        withdrawTokens();

        lockedSOV.depositSOV(msg.sender, reward);

        emit RewardTokenWithdraw(msg.sender, reward);
    }

    /* Getter Functions */

    /**
     * @notice Function to read the reward a particular user can get.
     * @param _addr The address of the user whose reward is to be read.
     * @return reward The reward received by the user.
     */
    function getReward(address _addr) external view returns (uint256 reward) {
        if (userBalances[_addr].mul(totalRewardDeposit) == 0) {
            return 0;
        }
        return userBalances[_addr].mul(totalRewardDeposit).div(totalDeposit);
    }
}
