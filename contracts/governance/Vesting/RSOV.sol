pragma solidity ^0.5.17;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../Staking/SafeMath96.sol";

//TODO should be set as protocolTokenAddress (ProtocolSettings.setProtocolTokenAddress)
//TODO PriceFeeds._protocolTokenAddress ?
/**
* Sovryn Reward Token
*/
contract RSOV is ERC20, ERC20Detailed, Ownable, SafeMath96 {
    
    string constant NAME = "Sovryn Reward Token";
    string constant SYMBOL = "RSOV";
    uint8 constant DECIMALS = 18;
    
    ///@notice 6 months (13 periods of 14 days)
    uint constant HALF_YEAR = 182 days;
    ///@notice 2 weeks in seconds
    uint constant TWO_WEEKS = 1209600;
    
    ///@notice the SOV token contract
    IERC20 public SOV;
    ///@notice the staking contract
    IStaking public staking;
    ///@notice the staking duration for SOV tokens
    uint public stakingDuration = HALF_YEAR;
    
    event Mint(address indexed sender, uint amount);
    event Burn(address indexed sender, uint amount);
    
    /**
    * @notice creates reward token
    * @param _SOV the SOV token address
    * @param _staking the staking contract address
    * */
    constructor(
        address _SOV,
        address _staking
    )
        ERC20Detailed(NAME, SYMBOL, DECIMALS)
        public
    {
        require(_SOV != address(0), "RSOV::SOV address invalid");
        require(_staking != address(0), "RSOV::staking address invalid");
    
        SOV = IERC20(_SOV);
        staking = IStaking(_staking);
        stakingDuration = HALF_YEAR;
    }
    
    /**
     * @notice holds SOV tokens and mints the respective amount of RSOV tokens
     * @param _amount the amount of tokens to be mint
     */
    function mint(uint96 _amount) public {
        require(_amount > 0, "RSOV::mint: amount invalid");
        
        //holds SOV tokens
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);
        
        //mints RSOV tokens
        _mint(msg.sender, _amount);
        
        emit Mint(msg.sender, _amount);
    }
    
    /**
     * @notice burns RSOV tokens and stakes the respective amount SOV tokens in the user's behalf
     * @param _amount the amount of tokens to be burnt
     */
    function burn(uint96 _amount) public {
        require(_amount > 0, "RSOV:: burn: amount invalid");

        //burns RSOV tokens
        _burn(msg.sender, _amount);
        
        //stakes SOV tokens in the user's behalf
        SOV.approve(address(staking), _amount);
        uint until = block.timestamp + stakingDuration;
        staking.stake(_amount, until, msg.sender, msg.sender);
    
        emit Burn(msg.sender, _amount);
    }
    
    function setStakingDuration(uint _stakingDuration) public onlyOwner {
        require(_stakingDuration >= TWO_WEEKS, "RSOV:: staking duration is too short");
        
        stakingDuration = _stakingDuration;
    }

}

interface IStaking {
    function stake(uint96 amount, uint until, address stakeFor, address delegatee) external;
}
