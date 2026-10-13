// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @dev Minimal subset of the iToken surface this wrapper calls. Avoid
///      pulling the full ILoanTokenModules so this stand-in stays focused.
interface IiTokenForQaWrapper {
    function mintWithBTC(
        address receiver,
        bool useLM
    ) external payable returns (uint256 mintAmount);

    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 gross, uint256 delivered);
}

/// @notice QA-fork-only stand-in for a product that borrows or withdraws on a
///         user's behalf — a wallet, vault, or any other contract sitting
///         between the user and a lending pool. `perimeter:qa up` deploys
///         this once (state file: `withdrawWrapper`), and `perimeter:qa
///         withdraw --through <wrapper>` drives it, so a queued exit's
///         recorded OWNER is a contract — otherwise nothing the QA engine
///         can produce, because every other driver calls the pool directly
///         as the withdrawing EOA.
///
///         One function: mint an iToken position with the caller's own
///         RBTC, then immediately burn that same position back to native
///         RBTC paid to `receiver`. `msg.sender` at BOTH the mint and the
///         burn is this contract, so the queued request's originator and
///         owner are the wrapper's own address; `receiver` is whichever
///         address the caller names — ordinarily themselves. Never holds a
///         position across transactions: mint and burn net to zero token
///         balance in the same call, exactly like a vault that passes a
///         user's funds straight through.
///
///         Test-only code. Not a model of any real integrator's contract —
///         see contracts/mockup/perimeter/MockThirdPartyWrapper.sol for that
///         role; this one exists solely to produce a contract-owned queued
///         request for the QA engine to drive.
contract MockQaThroughWrapper {
    function withdrawLenderOnBehalf(
        address iToken,
        address receiver
    ) external payable returns (uint256 minted) {
        minted = IiTokenForQaWrapper(iToken).mintWithBTC.value(msg.value)(address(this), false);
        require(minted > 0, "MockQaThroughWrapper: nothing minted");
        IiTokenForQaWrapper(iToken).burnToBTC(receiver, minted, false);
    }
}
