pragma solidity 0.5.17;

import "../openzeppelin/SafeMath.sol";

/**
 * @title Redemption accounting shared by the WRBTC loan token stand-ins below.
 *
 * A burn redeems `burnAmount` of the caller's shares. `gross` is what leaves
 * the pool: the burn amount, or 0 when a share prices to zero. A Perimeter fee
 * of `feeBps` is kept out of `gross` and the rest is sent to the receiver as
 * RBTC, unless the payout is held: then it stays here, as it would in the
 * withdrawal delay queue, and nothing reaches the receiver in the call. Every
 * amount is under the test's control.
 */
contract MockLoanTokenWrbtcRedemption {
    using SafeMath for uint256;

    /// Share of the gross kept as the Perimeter fee, in basis points.
    uint256 public feeBps;
    /// When true the payout is held and nothing reaches the receiver in the call.
    bool public holdAll;
    /// When true a share prices to zero, so a burn redeems nothing.
    bool public redeemsToZero;

    mapping(address => uint256) public balanceOf;

    function() external payable {}

    function setFeeBps(uint256 _feeBps) external {
        require(_feeBps <= 10000, "fee over 100%");
        feeBps = _feeBps;
    }

    function setHoldAll(bool _holdAll) external {
        holdAll = _holdAll;
    }

    function setRedeemsToZero(bool _redeemsToZero) external {
        redeemsToZero = _redeemsToZero;
    }

    /// Credit a holder so the burn has something to redeem against.
    function mintTo(address holder, uint256 amount) external {
        balanceOf[holder] = balanceOf[holder].add(amount);
    }

    /// @return gross What left the pool for the burn.
    /// @return delivered What reached `receiver` in this call.
    function _redeem(
        address receiver,
        uint256 burnAmount
    ) internal returns (uint256 gross, uint256 delivered) {
        require(balanceOf[msg.sender] >= burnAmount, "burn exceeds balance");
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(burnAmount);

        gross = redeemsToZero ? 0 : burnAmount;
        uint256 net = gross.sub(gross.mul(feeBps).div(10000));
        if (holdAll || net == 0) return (gross, 0);

        (bool success, ) = receiver.call.value(net)("");
        require(success, "delivery failed");
        return (gross, net);
    }
}

/// @title WRBTC loan token stand-in whose `burnToBTC` reports `(gross, delivered)`.
contract MockLoanTokenWrbtcPartialDelivery is MockLoanTokenWrbtcRedemption {
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool
    ) external returns (uint256 gross, uint256 delivered) {
        return _redeem(receiver, burnAmount);
    }
}

/// @title WRBTC loan token stand-in whose `burnToBTC` returns one value, `gross`.
contract MockLoanTokenWrbtcOneValueBurn is MockLoanTokenWrbtcRedemption {
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool
    ) external returns (uint256 gross) {
        (gross, ) = _redeem(receiver, burnAmount);
    }
}
