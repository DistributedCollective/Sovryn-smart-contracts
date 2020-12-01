pragma solidity ^0.5.17;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../Staking/SafeMath96.sol";

/**
* Sovryn Reward Token
*/
contract RSOV is ERC20, ERC20Detailed, SafeMath96 {
    
    string constant NAME = "Sovryn Reward Token";
    string constant SYMBOL = "RSOV";
    uint8 constant DECIMALS = 18;
    
    ///@notice the SOV token contract
    IERC20 public SOV;
    ///@notice the staking contract
    IStaking public staking;
    
    //TODO should we use constants ?
//    constructor(
//        string memory _name,
//        string memory _symbol,
//        uint8 _decimals,
//        address _SOV,
//        address _staking
//    )
//        ERC20Detailed(_name, _symbol, _decimals)
//        public
//    {
//        require(_SOV != address(0), "SOV address invalid");
//        require(_staking != address(0), "staking address invalid");
//
//        SOV = IERC20(_SOV);
//        staking = IStaking(_staking);
//    }
    
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
    
    function mint(uint256 _amount) public {
        require(_amount > 0, "RSOV::mint: amount invalid");
        
        //holds SOV
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);
        
        //mints RSOV tokens
        _mint(msg.sender, _amount);
    }
    
    function burn(uint256 _amount) public {
        require(_amount > 0, "RSOV:: burn: amount invalid");
        uint96 amount96 = safe96(_amount, "RSOV::burn: amount exceeds 96 bits");
        
        //burns RSOV tokens
        _burn(msg.sender, _amount);
        
        //stakes SOV tokens in the user's behalf
        SOV.approve(address(staking), _amount);
        //TODO staking duration, should it be possible to update ?
        uint until = block.timestamp + staking.MAX_DURATION();
        staking.stake(amount96, until, msg.sender, msg.sender);
    }

}

interface IStaking {
    function stake(uint96 amount, uint until, address stakeFor, address delegatee) external;
    function MAX_DURATION() external returns (uint);
}
