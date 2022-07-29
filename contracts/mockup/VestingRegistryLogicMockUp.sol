pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;
import "../governance/Vesting/VestingRegistryLogic.sol";

contract VestingRegistryLogicMockup is VestingRegistryLogic {
    function isVestingAdress(address _vestingAddress) external view returns (bool isVestingAddr) {
        return true;
    }

    function setTeamVesting(
        address _vesting,
        address _tokenOwner,
        uint256 _cliff,
        uint256 _duration,
        uint256 _vestingCreationType
    ) external {
        uint256 type_ = uint256(VestingType.TeamVesting);
        uint256 uid =
            uint256(
                keccak256(
                    abi.encodePacked(_tokenOwner, type_, _cliff, _duration, _vestingCreationType)
                )
            );
        vestings[uid].vestingAddress = _vesting;
    }
}
