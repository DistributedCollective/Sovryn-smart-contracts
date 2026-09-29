pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./shared/StakingShared.sol";
import "./shared/CheckpointsShared.sol";
import "../../../proxy/modules/interfaces/IFunctionsList.sol";

/**
 * @title Staking Recovery Module (one-off).
 * @notice Salvage module for the September 2026 governance-capture incident.
 *
 * Two single-purpose calls, both restricted to the governance owner (the owner
 * timelock), both with every address hard coded at compile time:
 *
 *  - recoverAttackerStake() moves the SOV staked by both attacker addresses to
 *    the Exchequer, in one call so neither can be left behind. Both their lock
 *    date and their addresses are fixed, so it needs no argument at all.
 *  - recoverGuardiansStake(until) moves back the SOV the Contracts Guardians
 *    Safe staked to defend the vote. Only its lock date is a parameter: that
 *    stake is placed during the incident, so which two-week slot it lands on
 *    depends on when the Safe bundle runs.
 *
 * The module can touch no position but these three and can send tokens nowhere
 * but the Exchequer. Neither call applies the early-unstaking penalty: the
 * attacker's SOV is being returned to users rather than slashed into fee
 * sharing, and the Guardians' stake is a salvage measure, not a yield position.
 *
 * @dev Deliberately carries no whenNotFrozen / whenNotPaused guard. Staking is
 * frozen for the whole incident, so a guarded call would revert on execution
 * and waste the vote. The SIP that adds this module removes it again in the
 * same transaction.
 * */
contract StakingRecoveryModule is IFunctionsList, StakingShared, CheckpointsShared {
    /// @notice The attacker address that staked to seize governance.
    address public constant ATTACKER = 0xac3ecE58a142e829Ef60f224F2FA8F4c98d6dEE8;

    /// @notice The second address the attack voted from, staked after the
    /// @notice malicious proposal was created.
    address public constant ATTACKER_SECONDARY = 0x92972392e3AfBd8C0F417441325b8688e2b7e774;

    /// @notice Contracts Guardians Safe - staked to out-vote the attacker.
    address public constant GUARDIANS_SAFE = 0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7;

    /// @notice Exchequer Multisig - receives everything this module recovers.
    address public constant EXCHEQUER = 0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711;

    /// @notice The lock date both attacker addresses staked to.
    /// @dev Fixed, not searched for: staking stays frozen until this proposal
    /// @dev executes, so neither position can be topped up, moved to another
    /// @dev date or opened anywhere else in the meantime. Verified against live
    /// @dev state - each address holds exactly one position, at this date, with
    /// @dev nothing at any other date on the grid.
    uint256 public constant ATTACKER_LOCK_DATE = 1884076095;

    /// @notice Emitted when a stake is recovered without the early-unstaking penalty.
    /// @param staker The account the stake is taken from.
    /// @param amount The number of tokens moved.
    /// @param until The lock date the stake sat on.
    /// @param receiver The receiver of the tokens, always the Exchequer.
    event StakeRecovered(
        address indexed staker,
        uint256 amount,
        uint256 until,
        address indexed receiver
    );

    /**
     * @notice Move everything both attacker addresses have staked to the
     * Exchequer, penalty free.
     * @dev Takes both positions at ATTACKER_LOCK_DATE in one call, and the
     * combined balance leaves in a single transfer, so neither address can be
     * left behind by the proposal. Reverts only when both hold nothing, so a
     * recovery still succeeds if one of them has already been emptied.
     * */
    function recoverAttackerStake() external onlyOwner {
        uint96 total = _take(ATTACKER, ATTACKER_LOCK_DATE);
        total = add96(total, _take(ATTACKER_SECONDARY, ATTACKER_LOCK_DATE), "total overflow"); // SR02
        _payOut(total);
    }

    /**
     * @notice Return the SOV the Contracts Guardians Safe staked to the Exchequer, penalty free.
     * @param until The lock date the Guardians Safe staked to.
     * @dev The date is a parameter because the maximum lock date moves with the
     * two-week grid, so which slot the defensive stake lands on depends on when
     * the Safe bundle runs and is not known when this module is written. The
     * proposal reads it from chain. Reverts when the Safe holds nothing at that
     * date. The staker and the receiver are fixed, so the call can only ever
     * return the Guardians' own stake to the treasury, and the same defensive
     * stake can be made and recovered again in a later incident.
     * */
    function recoverGuardiansStake(uint256 until) external onlyOwner {
        _payOut(_take(GUARDIANS_SAFE, until));
    }

    /**
     * @notice Unstake an account's position at one lock date, without the
     * early-unstaking penalty, crediting the caller with the amount instead of
     * transferring it.
     * @param staker The account the stake is taken from.
     * @param until The lock date to take it from.
     * @return The amount taken, zero when nothing is staked at that date.
     * @dev Checkpoint bookkeeping mirrors a normal withdrawal - daily stake,
     * user stake and delegate stake - so totals and voting power stay
     * consistent. Only the account's own staked balance is taken: voting power
     * delegated to it by others belongs to those stakers and is left where it
     * is. Vesting positions are refused: they unstake through the vesting paths,
     * which keep extra vesting checkpoints this does not write.
     * */
    function _take(address staker, uint256 until) internal returns (uint96) {
        require(!_isVestingContract(staker), "not for vesting contracts"); // SR01

        uint32 checkpoints = numUserStakingCheckpoints[staker][until];
        if (checkpoints == 0) return 0;
        uint96 balance = userStakingCheckpoints[staker][until][checkpoints - 1].stake;
        if (balance == 0) return 0;

        _decreaseDailyStake(until, balance);
        _decreaseUserStake(staker, until, balance);
        _decreaseDelegateStake(delegates[staker][until], until, balance);

        emit StakeRecovered(staker, balance, until, EXCHEQUER);
        emit StakingWithdrawn(staker, balance, until, EXCHEQUER, true);
        return balance;
    }

    /**
     * @notice Send a recovered total to the Exchequer.
     * @param total The combined balance taken from the swept accounts.
     * @dev Reverts when the sweep found nothing, so a proposal that would move
     * no tokens fails loudly rather than emitting an empty success.
     * */
    function _payOut(uint96 total) internal {
        require(total > 0, "nothing staked to recover"); // SR03
        require(SOVToken.transfer(EXCHEQUER, total), "Token transfer failed"); // SR04
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](2);
        functionsList[0] = this.recoverAttackerStake.selector;
        functionsList[1] = this.recoverGuardiansStake.selector;
        return functionsList;
    }
}
