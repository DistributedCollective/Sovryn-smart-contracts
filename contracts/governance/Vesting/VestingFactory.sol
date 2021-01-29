pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./Vesting.sol";
import "./TeamVesting.sol";
import "./DevelopmentVesting.sol";

contract VestingFactory is Ownable {
    ///@notice the SOV token contract
    address public SOV;
    ///@notice the staking contract address
    address public staking;
    //@notice fee sharing proxy
    address public feeSharing;

    //TODO do we need to support N CSOV ?
    ///@notice the CSOV token contract
    IERC20 public CSOV;

    //user => vesting type => vesting contract
    mapping(address => mapping(uint => address)) public vestingContracts;

    enum VestingType {
        MultisigVesting, //TeamVesting
        TokenHolderVesting, //Vesting
        DevelopmentVesting //Adoption fund, Development fund
    }

    constructor(
        address _SOV,
        address _staking,
        address _feeSharing,
        address _CSOV
    ) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_staking != address(0), "staking address invalid");
        require(_feeSharing != address(0), "feeSharing address invalid");
        require(_CSOV != address(0), "CSOV address invalid");

        SOV = _SOV;
        staking = _staking;
        feeSharing = _feeSharing;
        CSOV = IERC20(_CSOV);
    }


    //TODO do we need a blacklist?
    function exchangeCSOV(uint96 _amount) public {
        require(_amount > 0, "amount invalid");

        //TODO transfer or mark as already converted if non-transferable
        //holds CSOV tokens, an appropriate fund should be a message sender
        bool success = CSOV.transferFrom(msg.sender, address(this), _amount);
        require(success, "transfer failed");


        //create vesting contract or load an existing one

        //stakeTokens

        //event
    }

    function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address) {
        uint type_ = uint(VestingType.TokenHolderVesting);
        if (vestingContracts[_tokenOwner][type_] == address(0)) {
            vestingContracts[_tokenOwner][type_] = address(new Vesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharing));
        }
        return vestingContracts[_tokenOwner][type_];
    }

    function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address) {
        uint type_ = uint(VestingType.MultisigVesting);
        if (vestingContracts[_tokenOwner][type_] == address(0)) {
            vestingContracts[_tokenOwner][type_] = address(new TeamVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharing));
        }
        return vestingContracts[_tokenOwner][type_];
    }

    function _getOrCreateDevelopmentVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _frequency) internal returns (address) {
        uint type_ = uint(VestingType.DevelopmentVesting);
        if (vestingContracts[_tokenOwner][type_] == address(0)) {
            vestingContracts[_tokenOwner][type_] = address(new DevelopmentVesting(SOV, _tokenOwner, _cliff, _duration, _frequency));
        }
        return vestingContracts[_tokenOwner][type_];
    }


}
