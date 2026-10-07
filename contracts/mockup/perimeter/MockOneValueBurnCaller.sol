// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/// @dev The iToken burn entry points declared with a single `uint256` return.
///      A caller compiled against this interface decodes the first word of the
///      return data.
interface IOneValueBurn {
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    function burn(address receiver, uint256 burnAmount) external returns (uint256);

    function burn(address receiver, uint256 burnAmount, bool useLM) external returns (uint256);

    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256);
}

/// @notice Test caller compiled against the one-value burn signatures. Each entry
///         pulls `burnAmount` iTokens from the caller (who approves this contract
///         first), burns them with the proceeds going to `receiver`, and stores
///         the value its call decoded in `lastReturned`.
contract MockOneValueBurnCaller {
    uint256 public lastReturned;

    function callBurn(address iToken, address receiver, uint256 burnAmount) external {
        _pull(iToken, burnAmount);
        lastReturned = IOneValueBurn(iToken).burn(receiver, burnAmount);
    }

    function callBurnUseLM(
        address iToken,
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external {
        _pull(iToken, burnAmount);
        lastReturned = IOneValueBurn(iToken).burn(receiver, burnAmount, useLM);
    }

    function callBurnToBTC(
        address iToken,
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external {
        _pull(iToken, burnAmount);
        lastReturned = IOneValueBurn(iToken).burnToBTC(receiver, burnAmount, useLM);
    }

    function _pull(address iToken, uint256 amount) internal {
        require(
            IOneValueBurn(iToken).transferFrom(msg.sender, address(this), amount),
            "MockOneValueBurnCaller: transferFrom failed"
        );
    }
}
