pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStorage.sol";
import "./interfaces/ProtocolLike.sol";
import "./interfaces/FeedsLike.sol";
import "./interfaces/ProtocolSettingsLike.sol";
import "../../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../../farm/ILiquidityMining.sol";
import "../../governance/Staking/interfaces/IStaking.sol";
import "../../governance/Vesting/IVesting.sol";

/**
 * @dev This contract share the functions that are being used internally by both LoanTokenLogicSplit and LoanTokenLogicStandard
 */
contract LoanTokenLogicShared is LoanTokenLogicStorage {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /// DON'T ADD VARIABLES HERE, PLEASE

    /**
     * @notice Update the user's checkpoint price and profit so far.
     * In this loan token contract, whenever some tokens are minted or burned,
     * the _updateCheckpoints() function is invoked to update the stats to
     * reflect the balance changes.
     *
     * @param _user The user address.
     * @param _oldBalance The user's previous balance.
     * @param _newBalance The user's updated balance.
     * @param _currentPrice The current loan token price.
     * */
    function _updateCheckpoints(
        address _user,
        uint256 _oldBalance,
        uint256 _newBalance,
        uint256 _currentPrice
    ) internal {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(_user, iToken_ProfitSoFar));

        int256 _currentProfit;
        if (_newBalance == 0) {
            _currentPrice = 0;
        } else if (_oldBalance != 0) {
            _currentProfit = _profitOf(slot, _oldBalance, _currentPrice, checkpointPrices_[_user]);
        }

        assembly {
            sstore(slot, _currentProfit)
        }

        checkpointPrices_[_user] = _currentPrice;
    }

    /** INTERNAL FUNCTION */

    /**
     * @notice Transfer tokens, low level.
     * Checks allowance, updates sender and recipient balances
     * and updates checkpoints too.
     *
     * @param _from The tokens' owner.
     * @param _to The recipient of the tokens.
     * @param _value The amount of tokens sent.
     * @param _allowanceAmount The amount of tokens allowed to transfer.
     *
     * @return Success true/false.
     * */
    function _internalTransferFrom(
        address _from,
        address _to,
        uint256 _value,
        uint256 _allowanceAmount
    ) internal returns (bool) {
        if (_allowanceAmount != uint256(-1)) {
            allowed[_from][msg.sender] = _allowanceAmount.sub(_value, "14");
            /// @dev Allowance mapping update requires an event log
            emit AllowanceUpdate(_from, msg.sender, _allowanceAmount, allowed[_from][msg.sender]);
        }

        require(_to != address(0), "15");

        uint256 _balancesFrom = balances[_from];
        uint256 _balancesFromNew = _balancesFrom.sub(_value, "16");
        balances[_from] = _balancesFromNew;

        uint256 _balancesTo = balances[_to];
        uint256 _balancesToNew = _balancesTo.add(_value);
        balances[_to] = _balancesToNew;

        /// @dev Handle checkpoint update.
        uint256 _currentPrice = tokenPrice();

        //checkpoints are not being used by the smart contract logic itself, but just for external use (query the profit)
        //only update the checkpoints of a user if he's not depositing to / withdrawing from the lending pool
        if (_from != liquidityMiningAddress && _to != liquidityMiningAddress) {
            _updateCheckpoints(_from, _balancesFrom, _balancesFromNew, _currentPrice);
            _updateCheckpoints(_to, _balancesTo, _balancesToNew, _currentPrice);
        }

        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @notice Profit calculation based on checkpoints of price.
     * @param slot The user slot.
     * @param _balance The user balance.
     * @param _currentPrice The current price of the loan token.
     * @param _checkpointPrice The price of the loan token on checkpoint.
     * @return The profit of a user.
     * */
    function _profitOf(
        bytes32 slot,
        uint256 _balance,
        uint256 _currentPrice,
        uint256 _checkpointPrice
    ) internal view returns (int256 profitSoFar) {
        if (_checkpointPrice == 0) {
            return 0;
        }

        assembly {
            profitSoFar := sload(slot)
        }

        profitSoFar = int256(_currentPrice)
            .sub(int256(_checkpointPrice))
            .mul(int256(_balance))
            .div(sWEI_PRECISION)
            .add(profitSoFar);
    }

    /**
     * @notice Loan token price calculation considering unpaid interests.
     * @return The loan token price.
     * */
    function tokenPrice() public view returns (uint256 price) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _tokenPrice(_totalAssetSupply(interestUnPaid));
    }

    /**
     * @notice Get the total amount of loan tokens on debt.
     * Calls protocol getTotalPrincipal function.
     * In the context of borrowing, principal is the initial size of a loan.
     * It can also be the amount still owed on a loan. If you take out a
     * $50,000 mortgage, for example, the principal is $50,000. If you pay off
     * $30,000, the principal balance now consists of the remaining $20,000.
     *
     * @return The total amount of loan tokens on debt.
     * */
    function totalAssetBorrow() public view returns (uint256) {
        return
            ProtocolLike(sovrynContractAddress).getTotalPrincipal(address(this), loanTokenAddress);
    }

    /** INTERNAL FUNCTION */

    /**
     * @notice .
     *
     * @param collateralTokenAddress The address of the token to be used as
     *   collateral. Cannot be the loan token address.
     * @param sentAddresses The addresses to send tokens: lender, borrower,
     *   receiver and manager.
     * @param sentAmounts The amounts to send to each address.
     * @param withdrawalAmount The amount of tokens to withdraw.
     *
     * @return msgValue The amount of rBTC sent minus the collateral on tokens.
     * */
    function _verifyTransfers(
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = loanTokenAddress;
        uint256 newPrincipal = sentAmounts.newPrincipal;
        uint256 loanTokenSent = sentAmounts.loanTokenSent;
        uint256 collateralTokenSent = sentAmounts.collateralTokenSent;

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            _safeTransfer(_loanTokenAddress, sentAddresses.receiver, withdrawalAmount, "");
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
        }
        /**
         * This is a critical piece of code!
         * rBTC are supposed to be held by the contract itself, while other tokens are being transfered from the sender directly.
         * */
        if (collateralTokenSent != 0) {
            if (
                collateralTokenAddress == _wrbtcToken &&
                msgValue != 0 &&
                msgValue >= collateralTokenSent
            ) {
                IWrbtc(_wrbtcToken).deposit.value(collateralTokenSent)();
                _safeTransfer(
                    collateralTokenAddress,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-a"
                );
                msgValue -= collateralTokenSent;
            } else {
                _safeTransferFrom(
                    collateralTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-b"
                );
            }
        }

        if (loanTokenSent != 0) {
            _safeTransferFrom(
                _loanTokenAddress,
                msg.sender,
                sovrynContractAddress,
                loanTokenSent,
                "29"
            );
        }
    }

    /**
     * @notice Withdraw loan token interests from protocol.
     * This function only operates once per block.
     * It asks protocol to withdraw accrued interests for the loan token.
     *
     * @dev Internal sync required on every loan trade before starting.
     * */
    function _settleInterest() internal {
        uint88 ts = uint88(block.timestamp);
        if (lastSettleTime_ != ts) {
            ProtocolLike(sovrynContractAddress).withdrawAccruedInterest(loanTokenAddress);

            lastSettleTime_ = ts;
        }
    }

    /**
     * @notice Imitate a Solidity high-level call (i.e. a regular function
     * call to a contract), relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be
     * false).
     *
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     * @param errorMsg The error message on failure.
     * */
    function _callOptionalReturn(
        address token,
        bytes memory data,
        string memory errorMsg
    ) internal {
        require(Address.isContract(token), "call to a non-contract address");
        (bool success, bytes memory returndata) = token.call(data);
        require(success, errorMsg);

        if (returndata.length != 0) {
            require(abi.decode(returndata, (bool)), errorMsg);
        }
    }

    /**
     * @notice Execute the ERC20 token's `transfer` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransfer(
        address token,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount),
            errorMsg
        );
    }

    /**
     * @notice Execute the ERC20 token's `transferFrom` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param from The source address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, amount),
            errorMsg
        );
    }

    /** Internal view function */
    /**
     * @notice Compute the token price.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The token price.
     * */
    function _tokenPrice(uint256 assetSupply) internal view returns (uint256) {
        uint256 totalTokenSupply = totalSupply_;

        return
            totalTokenSupply != 0 ? assetSupply.mul(10**18).div(totalTokenSupply) : initialPrice;
    }

    /**
     * @notice Get two kind of interests: owed per day and yet to be paid.
     * @return interestOwedPerDay The interest per day.
     * @return interestUnPaid The interest not yet paid.
     * */
    function _getAllInterest()
        internal
        view
        returns (uint256 interestOwedPerDay, uint256 interestUnPaid)
    {
        /// interestPaid, interestPaidDate, interestOwedPerDay, interestUnPaid, interestFeePercent, principalTotal
        uint256 interestFeePercent;
        (, , interestOwedPerDay, interestUnPaid, interestFeePercent, ) = ProtocolLike(
            sovrynContractAddress
        )
            .getLenderInterestData(address(this), loanTokenAddress);

        interestUnPaid = interestUnPaid.mul(SafeMath.sub(10**20, interestFeePercent)).div(10**20);
    }

    /**
     * @notice Compute the total amount of loan tokens on supply.
     * @param interestUnPaid The interest not yet paid.
     * @return assetSupply The total amount of loan tokens on supply.
     * */
    function _totalAssetSupply(uint256 interestUnPaid)
        internal
        view
        returns (uint256 assetSupply)
    {
        if (totalSupply_ != 0) {
            uint256 assetsBalance = _flTotalAssetSupply; /// Temporary locked totalAssetSupply during a flash loan transaction.
            if (assetsBalance == 0) {
                assetsBalance = _underlyingBalance().add(totalAssetBorrow());
            }

            return assetsBalance.add(interestUnPaid);
        }
    }

    /**
     * @notice Get the loan contract balance.
     * @return The balance of the loan token for this contract.
     * */
    function _underlyingBalance() internal view returns (uint256) {
        return IERC20(loanTokenAddress).balanceOf(address(this));
    }
}
