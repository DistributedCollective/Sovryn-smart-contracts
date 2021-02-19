pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./VestingRegistry.sol";
import "../Staking/Staking.sol";

/**
 * @title Origin investors claim vested cSOV tokens
 * @notice // TODO: fund this contract with a total amount of SOV needed to distribute
 */
contract OriginInvestorsClaim is Ownable {
	using SafeMath for uint256;

	//VestingRegistry public constant vestingRegistry = VestingRegistry(0x80B036ae59B3e38B573837c01BB1DB95515b7E6B);

	///@notice constant used for computing the vesting dates
	uint256 public constant SIX_WEEKS = 6 weeks;

	uint256 public constant SOV_VESTING_CLIFF = SIX_WEEKS;
	uint256 public constant SOV_VESTING_DURATION = SOV_VESTING_CLIFF;

	VestingRegistry public vestingRegistry;
	Staking public staking;
	uint256 public kickoffTS;
	IERC20 public SOVToken;
	uint256 public vestingTerm;

	//user => flag whether user has already claimed vested SOV
	mapping(address => bool) public vestingList;
	//user => flag whether user has already withdrawn SOV
	mapping(address => bool) public withdrawnList;
	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	mapping(address => uint256) public investorsAmountsList; // origin investors entitled to claim SOV

	event AdminAdded(address admin);
	event AdminRemoved(address admin);
	event InvestorsAmountsListSet(uint256 qty);

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "unauthorized");
		_;
	}

	modifier onlyWhitelisted() {
		require(investorsAmountsList[msg.sender] != 0, "not whitelisted");
		_;
	}

	modifier notInVestingList() {
		require(!vestingList[msg.sender], "address is in the vestingList");
		_;
	}

	modifier notWithdrawn() {
		require(!withdrawnList[msg.sender], "tokens already withdrawn");
		_;
	}

	constructor(address vestingRegistryAddress) public {
		vestingRegistry = VestingRegistry(vestingRegistryAddress);
		staking = Staking(vestingRegistry.staking());
		kickoffTS = staking.kickoffTS();
		SOVToken = staking.SOVToken();
		vestingTerm = kickoffTS + SOV_VESTING_CLIFF;
	}

	function addAdmin(address _admin) public onlyOwner {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	function removeAdmin(address _admin) public onlyOwner {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	//in case we have unclaimed tokens
	function ownerTtransferBalance(address toAddress) public onlyOwner {
		SOVToken.transfer(toAddress, SOVToken.balanceOf(address(this)));
	}

	function setInvestorsAmountsList(address[] memory investors, uint256[] memory claimAmounts) public onlyAuthorized {
		require(investors.length == claimAmounts.length, "investors.length != claimAmounts.length");
		for (uint256 i = 0; i < investors.length; i++) {
			investorsAmountsList[investors[i]] = claimAmounts[i];
		}

		emit InvestorsAmountsListSet(investors.length);
	}

	function claim() public onlyWhitelisted {
		if (now < vestingTerm) {
			createVesting();
		} else {
			withdraw();
		}
	}

	function createVesting() internal notInVestingList {
		uint256 cliff = vestingTerm.sub(now);
		uint256 duration = cliff;
		uint256 amount = investorsAmountsList[msg.sender];
		address vestingContractAddress;

		vestingList[msg.sender] = true;

		vestingRegistry.createVesting(msg.sender, amount, cliff, duration);
		vestingContractAddress = vestingRegistry.getVesting(msg.sender);
		vestingRegistry.stakeTokens(vestingContractAddress, amount);
	}

	function withdraw() internal notInVestingList notWithdrawn {
		withdrawnList[msg.sender] = true;

		// withdraw only for those claiming after the cliff, i.e. without vesting contracts
		// those with vestingContracts should withdraw using Vesting.withdrawTokens
		// from Vesting (VestingLogic) contract
		SOVToken.transfer(msg.sender, investorsAmountsList[msg.sender]);
	}
}
