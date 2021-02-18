pragma solidity ^0.5.17;

import "./VestingRegistry.sol";
import "../Staking/Staking.sol";

/**
 * @title Origin investors claim vested cSOV tokens
 * @dev this is a one-time throw away contract
 */
contract OriginInvestorsClaim is Ownable {
	using SafeMath for uint256;

	VestingRegistry public constant vestingRegistry = VestingRegistry(0x80B036ae59B3e38B573837c01BB1DB95515b7E6B);

	///@notice constant used for computing the vesting dates
	uint256 public constant SIX_WEEKS = 6 weeks;

	uint256 public constant SOV_VESTING_CLIFF = SIX_WEEKS;
	uint256 public constant SOV_VESTING_DURATION = SOV_VESTING_CLIFF;

	Staking public staking = Staking(vestingRegistry.staking());
	uint256 public kickoffTS = staking.kickoffTS();
	IERC20 public SOVToken = staking.SOVToken();
	uint256 public vestingTerm = kickoffTS + SOV_VESTING_CLIFF;

	//user => flag whether user has already claimed vested SOV
	mapping(address => bool) public createdVestingList;
	//user => flag whether user has already withdrawn vested SOV
	mapping(address => bool) public withdrawnList;
	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	mapping(address => uint256) public originInvestorsAmount; // origin investors entitled to claim vested SOV

	event AdminAdded(address admin);
	event AdminRemoved(address admin);

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "unauthorized");
		_;
	}

	modifier onlyWhitelisted() {
		require(originInvestorsAmount[msg.sender] != 0, "not whitelisted");
		_;
	}

	modifier notInCreatedVestingList() {
		require(!createdVestingList[msg.sender], "Address cannot be processed twice");
		_;
	}

	modifier notWithdrawn() {
		require(!withdrawnList[msg.sender], "Address cannot be processed twice");
		_;
	}

	function addAdmin(address _admin) public onlyOwner {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	function removeAdmin(address _admin) public onlyOwner {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	function setInvestorsWhitelist(address[] memory investors, uint256[] memory claimAmounts) public onlyAuthorized {
		require(investors.length == claimAmounts.length, "investors.length != claimAmounts.length");
		for (uint256 i = 0; i < investors.length; i++) {
			originInvestorsAmount[investors[i]] = claimAmounts[i];
		}
	}

	function claim() public onlyWhitelisted {
		if (now < vestingTerm) {
			createVesting();
		} else {
			withdraw();
		}
	}

	function createVesting() internal notInCreatedVestingList {
		uint256 cliff = vestingTerm.sub(now);
		uint256 duration = cliff;
		uint256 amount = originInvestorsAmount[msg.sender];
		address vestingContractAddress = vestingRegistry.getVesting(msg.sender);

		createdVestingList[msg.sender] = true;

		vestingRegistry.createVesting(msg.sender, amount, cliff, duration);
		vestingRegistry.stakeTokens(vestingContractAddress, amount);
	}

	function withdraw() internal notWithdrawn {
		withdrawnList[msg.sender] = true;

		if (createdVestingList[msg.sender]) {
			// withdraw from staking
			staking.withdraw(uint96(originInvestorsAmount[msg.sender]), vestingTerm, msg.sender);
		} else {
			// TODO: need to set alowance to the contract
			SOVToken.transfer(msg.sender, originInvestorsAmount[msg.sender]);
		}
	}
}
