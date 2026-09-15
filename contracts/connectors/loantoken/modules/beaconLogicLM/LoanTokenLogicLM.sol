// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicSplit.sol";

contract LoanTokenLogicLM is LoanTokenLogicSplit {
    /**
     * @notice This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
     * Every new public function, the signature needs to be included in this function.
     *
     * @dev This function will return the list of function signature in this contract that are available for public call
     * Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.
     * @dev To save the gas we can just directly return the list of function signature from this pure function.
     * The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
     * Then, in this function we just need to return that storage variable.
     *
     * @return The list of function signatures (bytes4[])
     */
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](6);

        // Loan Token LM & OVERLOADING function
        /**
         * @notice BE CAREFUL,
         * the 2-param mint & burn are overloads inherited from
         * LoanTokenLogicSplit (this contract `is LoanTokenLogicSplit`). With
         * overloaded names `this.mint.selector` is ambiguous, so the selectors
         * are computed manually --> bytes4(keccak256("mint(address,uint256,bool)")).
         */
        res[0] = bytes4(keccak256("mint(address,uint256)")); /// LoanTokenLogicSplit
        res[1] = bytes4(keccak256("mint(address,uint256,bool)")); /// LoanTokenLogicLM
        res[2] = bytes4(keccak256("burn(address,uint256)")); /// LoanTokenLogicSplit
        res[3] = bytes4(keccak256("burn(address,uint256,bool)")); /// LoanTokenLogicLM

        // Perimeter controller view.
        res[4] = bytes4(keccak256("exitFeeController()"));

        // Security-perimeter delay-queue view.
        res[5] = bytes4(keccak256("exitDelayQueue()"));

        return (res, stringToBytes32("LoanTokenLogicLM"));
    }

    /**
     * @notice deposit into the lending pool and optionally participate at the Liquidity Mining Program
     * @param receiver the receiver of the tokens
     * @param depositAmount The amount of underlying tokens provided on the loan.
     *						(Not the number of loan tokens to mint).
     * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
     */
    function mint(
        address receiver,
        uint256 depositAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 minted) {
        if (useLM) return _mintWithLM(receiver, depositAmount);
        else return _mintToken(receiver, depositAmount);
    }

    /**
     * @notice withdraws from the lending pool and optionally retrieves the pool tokens from the
     *         Liquidity Mining Contract
     * @param receiver the receiver of the underlying tokens. note: potetial LM rewards are always sent to the msg.sender
     * @param burnAmount The amount of pool tokens to redeem.
     * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
     * @return redeemed The GROSS amount of underlying tokens redeemed. When a
     *         Perimeter exit-fee policy is active the receiver is paid this amount
     *         minus the fee (split published in `ExitFeeApplied`) — do not
     *         treat the return value as the amount received.
     */
    function burn(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 redeemed) {
        if (useLM) redeemed = _burnFromLM(burnAmount);
        else redeemed = _burnToken(burnAmount);
        // Perimeter: charge the fee and pay the user. "asset transfer failed" is
        // the user-leg revert reason.
        _chargeExitFeeAndPay(receiver, redeemed, "asset transfer failed");
    }
}
