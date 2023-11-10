pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/interfaces/IStaking.sol";
import "../IFeeSharingCollector.sol";
import "./IVesting.sol";
import "../ApprovalReceiver.sol";
import "./VestingStorage.sol";

/**
 * @title Vesting Logic contract.
 * @notice Staking, delegating and withdrawal functionality.
 * @dev Deployed by a VestingFactory contract.
 * */
contract VestingLogic is IVesting, VestingStorage, ApprovalReceiver {
    /* Events */

    event TokensStaked(address indexed caller, uint256 amount);
    event VotesDelegated(address indexed caller, address delegatee);
    event TokensWithdrawn(address indexed caller, address receiver, uint256 end);
    event DividendsCollected(
        address indexed caller,
        address loanPoolToken,
        address receiver,
        uint32 maxCheckpoints
    );
    event MigratedToNewStakingContract(address indexed caller, address newStakingContract);

    /* Modifiers */

    /**
     * @dev Throws if called by any account other than the token owner or the contract owner.
     */
    modifier onlyOwners() {
        require(msg.sender == tokenOwner || isOwner(), "unauthorized");
        _;
    }

    /**
     * @dev Throws if called by any account other than the token owner.
     */
    modifier onlyTokenOwner() {
        require(msg.sender == tokenOwner, "unauthorized");
        _;
    }

    /* Functions */

    /**
     * @notice Stakes tokens according to the vesting schedule.
     * @param _amount The amount of tokens to stake.
     * */
    function stakeTokens(uint256 _amount) public {
        _stakeTokens(msg.sender, _amount);
    }

    /**
     * @notice Stakes tokens according to the vesting schedule.
     * @dev This function will be invoked from receiveApproval.
     * @dev SOV.approveAndCall -> this.receiveApproval -> this.stakeTokensWithApproval
     * @param _sender The sender of SOV.approveAndCall
     * @param _amount The amount of tokens to stake.
     * */
    function stakeTokensWithApproval(address _sender, uint256 _amount) public onlyThisContract {
        _stakeTokens(_sender, _amount);
    }

    /**
     * @notice Stakes tokens according to the vesting schedule. Low level function.
     * @dev Once here the allowance of tokens is taken for granted.
     * @param _sender The sender of tokens to stake.
     * @param _amount The amount of tokens to stake.
     * */
    function _stakeTokens(address _sender, uint256 _amount) internal {
        /// @dev Maybe better to allow staking unil the cliff was reached.
        if (startDate == 0) {
            startDate = staking.timestampToLockDate(block.timestamp);
        }
        endDate = staking.timestampToLockDate(block.timestamp + duration);

        /// @dev Transfer the tokens to this contract.
        bool success = SOV.transferFrom(_sender, address(this), _amount);
        require(success);

        /// @dev Allow the staking contract to access them.
        SOV.approve(address(staking), _amount);

        staking.stakeBySchedule(_amount, cliff, duration, FOUR_WEEKS, address(this), tokenOwner);

        emit TokensStaked(_sender, _amount);
    }

    /**
     * @notice Delegate votes from `msg.sender` which are locked until lockDate
     * to `delegatee`.
     * @param _delegatee The address to delegate votes to.
     * */
    function delegate(address _delegatee) public onlyTokenOwner {
        require(_delegatee != address(0), "delegatee address invalid");

        /// @dev Withdraw for each unlocked position.
        /// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
        ///		workaround found, but it doesn't work with TWO_WEEKS
        for (uint256 i = startDate + cliff; i <= endDate; i += FOUR_WEEKS) {
            staking.delegate(_delegatee, i);
        }
        emit VotesDelegated(msg.sender, _delegatee);
    }

    /**
     * @notice Withdraws unlocked tokens from the staking contract and
     * forwards them to an address specified by the token owner.
     * @param receiver The receiving address.
     * */
    function withdrawTokens(address receiver) public onlyOwners {
        _withdrawTokens(receiver, false, block.timestamp);
    }

    /**
     * @notice Withdraws unlocked tokens partially (based on the max withdraw iteration that has been set) from the staking contract and
     * forwards them to an address specified by the token owner.
     * @param receiver The receiving address.
     * @param startFrom The start value for the iterations.
     * */
    function withdrawTokensPartially(address receiver, uint256 startFrom) public onlyOwners {
        uint256 maxVestingWithdrawIterations = staking.getMaxVestingWithdrawIterations();
        /// @dev max iterations need to be decreased by 1, otherwise the iteration will always be surplus by 1
        uint256 totalIterationValue =
            (startFrom + (FOUR_WEEKS * (maxVestingWithdrawIterations - 1)));
        uint256 adjustedEnd = endDate < totalIterationValue ? endDate : totalIterationValue;
        _withdrawTokens(receiver, false, adjustedEnd);
    }

    /**
     * @notice Withdraws tokens from the staking contract and forwards them
     * to an address specified by the token owner. Low level function.
     * @dev Once here the caller permission is taken for granted.
     * @param receiver The receiving address.
     * @param isGovernance Whether all tokens (true)
     * or just unlocked tokens (false).
     * */
    function _withdrawTokens(
        address receiver,
        bool isGovernance,
        uint256 endRegularWithdrawal
    ) internal {
        require(receiver != address(0), "receiver address invalid");

        uint96 stake;

        /// @dev Usually we just need to iterate over the possible dates until now.
        uint256 end;

        /// @dev In the unlikely case that all tokens have been unlocked early,
        ///   allow to withdraw all of them.
        if (staking.allUnlocked() || isGovernance) {
            end = endDate;
        } else {
            end = endRegularWithdrawal < block.timestamp ? endRegularWithdrawal : block.timestamp;
        }

        /// @dev Withdraw for each unlocked position.
        /// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
        ///		workaround found, but it doesn't work with TWO_WEEKS
        for (uint256 i = startDate + cliff; i <= end; i += FOUR_WEEKS) {
            /// @dev Read amount to withdraw.
            stake = staking.getPriorUserStakeByDate(address(this), i, block.number - 1);

            /// @dev Withdraw if > 0
            if (stake > 0) {
                if (isGovernance) {
                    staking.governanceWithdraw(stake, i, receiver);
                } else {
                    staking.withdraw(stake, i, receiver);
                }
            }
        }

        emit TokensWithdrawn(msg.sender, receiver, end);
    }

    /**
     * @notice Collect dividends from fee sharing proxy.
     * @param _loanPoolToken The loan pool token address.
     * @param _maxCheckpoints Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function collectDividends(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) public onlyOwners {
        require(_receiver != address(0), "receiver address invalid");

        /// @dev Invokes the fee sharing proxy.
        feeSharingCollector.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);

        emit DividendsCollected(msg.sender, _loanPoolToken, _receiver, _maxCheckpoints);
    }

    /**
     * @notice Allows the owners to migrate the positions
     * to a new staking contract.
     * */
    function migrateToNewStakingContract() public onlyOwners {
        staking.migrateToNewStakingContract();
        staking = IStaking(staking.newStakingContract());
        emit MigratedToNewStakingContract(msg.sender, address(staking));
    }

    /**
     * @notice Overrides default ApprovalReceiver._getToken function to
     * register SOV token on this contract.
     * @return The address of SOV token.
     * */
    function _getToken() internal view returns (address) {
        return address(SOV);
    }

    /**
     * @notice Overrides default ApprovalReceiver._getSelectors function to
     * register stakeTokensWithApproval selector on this contract.
     * @return The array of registered selectors on this contract.
     * */
    function _getSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = this.stakeTokensWithApproval.selector;
        return selectors;
    }
}
