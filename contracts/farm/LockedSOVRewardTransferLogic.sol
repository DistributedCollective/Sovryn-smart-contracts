pragma solidity 0.5.17;

import "./IRewardTransferLogic.sol";
import "./LockedSOVRewardTransferLogicStorage.sol";
import "../locked/ILockedSOV.sol";

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";

contract LockedSOVRewardTransferLogic is
    IRewardTransferLogic,
    LockedSOVRewardTransferLogicStorage
{
    using SafeERC20 for IERC20;

    event LockedSOVChanged(address _newAddress);
    event UnlockImmediatelyPercentChanged(uint256 _newAmount);

    /**
     * @param _lockedSOV The contract instance address of the lockedSOV vault.
     *   SOV rewards are not paid directly to liquidity providers. Instead they
     *   are deposited into a lockedSOV vault contract.
     * @param _unlockedImmediatelyPercent The % which determines how much will be unlocked immediately.
     */
    function initialize(address _lockedSOV, uint256 _unlockedImmediatelyPercent)
        external
        onlyAuthorized
    {
        changeLockedSOV(_lockedSOV);
        changeUnlockedImmediatelyPercent(_unlockedImmediatelyPercent);
    }

    /**
     * @param _newLockedSOV The contract instance address of the lockedSOV vault.
     */
    function changeLockedSOV(address _newLockedSOV) public onlyAuthorized {
        require(_newLockedSOV != address(0), "Invalid address");
        lockedSOV = ILockedSOV(_newLockedSOV);
        emit LockedSOVChanged(_newLockedSOV);
    }

    /**
     * @param _newUnlockedImmediatelyPercent The new unlocked immediately percent.
     */
    function changeUnlockedImmediatelyPercent(uint256 _newUnlockedImmediatelyPercent)
        public
        onlyAuthorized
    {
        require(
            _newUnlockedImmediatelyPercent < 10000,
            "Unlocked immediately percent has to be less than 10000."
        );
        unlockedImmediatelyPercent = _newUnlockedImmediatelyPercent;
        emit UnlockImmediatelyPercentChanged(_newUnlockedImmediatelyPercent);
    }

    function getRewardTokenAddress() external view returns (address) {
        return lockedSOV.SOV();
    }

    function senderToAuthorize() external view returns (address) {
        return address(this);
    }

    function transferReward(
        address _to,
        uint256 _value,
        bool _isWithdrawal
    ) external {
        IERC20 token = IERC20(lockedSOV.SOV());
        require(token.transferFrom(msg.sender, address(this), _value), "Transfer failed");
        require(token.approve(address(lockedSOV), _value), "Approve failed");
        lockedSOV.deposit(_to, _value, unlockedImmediatelyPercent);
        if (!_isWithdrawal) {
            lockedSOV.withdrawAndStakeTokensFrom(_to);
        }
    }
}
