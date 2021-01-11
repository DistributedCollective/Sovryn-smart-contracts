pragma solidity 0.5.17;

import "../core/State.sol";
import "../feeds/IPriceFeeds.sol";

contract RewardHelper is State {
    using SafeMath for uint256;

    /**
     * @dev returns base fee + flex fee
     */
    function _getRolloverReward(
        address collateralToken,
        address loanToken,
        uint256 positionSize
    ) internal view returns (uint256 reward) {
        uint256 positionSizeInCollateralToken =
            IPriceFeeds(priceFeeds).queryReturn(
                loanToken,
                collateralToken,
                positionSize
            );
        uint256 rolloverBaseRewardInCollateralToken =
            IPriceFeeds(priceFeeds).queryReturn(
                address(wrbtcToken),
                collateralToken,
                rolloverBaseReward
            );

        return
            rolloverBaseRewardInCollateralToken
                .mul(2) // baseFee
                .add(
                positionSizeInCollateralToken.mul(rolloverFlexFeePercent).div(
                    10**20
                )
            ); // flexFee = 0.1% of position size
    }
}
