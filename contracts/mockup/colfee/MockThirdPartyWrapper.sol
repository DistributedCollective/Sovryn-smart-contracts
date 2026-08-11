// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @dev Minimal subset of the iToken surface this stand-in calls. Avoid
///      pulling the full ILoanTokenModules so the mockup stays focused.
interface IiTokenForWrapperTest {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function burn(address receiver, uint256 burnAmount) external returns (uint256 loanAmountPaid);
}

/// @notice Stand-in for a generic **3rd-party integrator** that wraps
///         `iToken.burn(...)`. NOT a model of the Sovryn dApp's flow — the
///         dApp calls the iToken directly with `useLM` as a flag (see
///         `sovryn-dapp/apps/frontend/src/app/5_pages/LendPage/hooks/useHandleLending.ts`,
///         which dispatches `burn(address,uint256,bool)` straight on the
///         iToken contract). This contract exists only to assert the
///         ColFee hook's actor-attribution behavior when some external
///         contract sits between the user and the iToken: that the
///         `ExitFeeApplied` event records `actor = msg.sender = wrapper`
///         and that the **surface/sub-product fee floor is still charged**
///         (no actor-policy bypass to 0 bps).
///
///         The production analog is
///         `oracle-based-amm/rbtcwrapperproxy/contracts/RBTCWrapperProxy.sol`'s
///         `removeFromLendingPool`, which additionally pulls iTokens out of
///         `LiquidityMining`. We skip the LM hop here because the LM
///         interaction is orthogonal to ColFee — the property we're proving
///         is purely about who `msg.sender` is at the `iToken.burn` call.
contract MockThirdPartyWrapper {
    /// @notice User must `iToken.approve(this, burnAmount)` first. Wrapper
    ///         pulls iTokens, calls `iToken.burn(receiver=user, burnAmount)`,
    ///         and the iToken delivers the underlying ERC20 (WRBTC included)
    ///         directly to the user. Wrapper never holds the underlying.
    function removeFromLendingPool(address iToken, uint256 burnAmount) external {
        require(
            IiTokenForWrapperTest(iToken).transferFrom(msg.sender, address(this), burnAmount),
            "MockThirdPartyWrapper: transferFrom failed"
        );
        IiTokenForWrapperTest(iToken).burn(msg.sender, burnAmount);
    }
}
