/// @notice Simulated swap network with favorable execution capped at one percent.
pragma solidity 0.5.17;

import "./TestToken.sol";
import "../feeds/IPriceFeeds.sol";
import "../openzeppelin/SafeMath.sol";
import "../interfaces/IERC20.sol";

contract TestSovrynSwapOverfill {
    using SafeMath for uint256;
    address public priceFeeds;
    uint256 public overfillBps;

    constructor(address feed) public {
        priceFeeds = feed;
    }
    function setOverfillBps(uint256 bps) external {
        require(bps <= 100, "fixture: bounded");
        overfillBps = bps;
    }
    function addressOf(bytes32) public view returns (address) {
        return address(this);
    }
    function conversionPath(
        IERC20 source,
        IERC20 target
    ) external pure returns (IERC20[] memory path) {
        path = new IERC20[](2);
        path[0] = source;
        path[1] = target;
    }
    function rateByPath(IERC20[] calldata path, uint256 amount) external view returns (uint256) {
        (uint256 rate, uint256 precision) = IPriceFeeds(priceFeeds).queryRate(
            address(path[0]),
            address(path[1])
        );
        return amount.mul(rate).div(precision);
    }
    function convertByPath(
        IERC20[] calldata path,
        uint256 amount,
        uint256 minReturn,
        address beneficiary,
        address,
        uint256
    ) external payable returns (uint256 actualReturn) {
        (uint256 rate, uint256 precision) = IPriceFeeds(priceFeeds).queryRate(
            address(path[0]),
            address(path[1])
        );
        actualReturn = amount.mul(rate).div(precision);
        // Only actual execution improves the quote. The production estimation,
        // source bounds, swap fee and oracle disagreement checks still execute.
        actualReturn = actualReturn.add(actualReturn.mul(overfillBps).div(10000));
        require(actualReturn >= minReturn, "fixture: insufficient fill");
        TestToken(address(path[0])).burn(msg.sender, amount);
        TestToken(address(path[1])).mint(beneficiary, actualReturn);
    }
}
