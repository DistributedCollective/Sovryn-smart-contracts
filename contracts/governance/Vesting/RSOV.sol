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

    ///@notice constants used for computing the vesting dates
    uint constant FOUR_WEEKS = 4 weeks;
    uint constant YEAR = 52 weeks;

    ///@notice the SOV token contract
    IERC20 public SOV;
    ///@notice the staking contract
    IStaking public staking;

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

        staking.stakeTokens(_amount, FOUR_WEEKS, YEAR, FOUR_WEEKS, msg.sender, msg.sender);

        emit Burn(msg.sender, _amount);
    }

}

interface IStaking {
    function stakeTokens(
        uint amount,
        uint cliff,
        uint duration,
        uint intervalLength,
        address stakeFor,
        address delegatee
    )
        external;

    function stake(uint96 amount, uint until, address stakeFor, address delegatee) external;
}
