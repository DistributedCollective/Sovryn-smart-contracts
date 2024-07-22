pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;
import "../governance/Vesting/VestingRegistry.sol";

contract VestingRegistryMockup is VestingRegistry {
    function isVestingAddress(address _vestingAddress) external view returns (bool isVestingAddr) {
        return true;
    }

    function setTeamVesting(address _vesting, uint256 _vestingCreationType) external {
        vestingCreationAndTypes[_vesting] = VestingCreationAndTypeDetails({
            isSet: true,
            vestingType: uint32(VestingType.TeamVesting),
            vestingCreationType: uint128(_vestingCreationType)
        });
    }
}
