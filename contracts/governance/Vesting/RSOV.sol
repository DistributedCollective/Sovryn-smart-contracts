pragma solidity ^0.5.17;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../Staking/Staking.sol";

//TODO Ownable ?
contract RSOV is ERC20, ERC20Detailed, Ownable, SafeMath96 {
    
    string constant NAME = "Sovryn Reward Token";
    string constant SYMBOL = "RSOV";
    uint8 constant DECIMALS = 18;
    
    ///@notice the SOV token contract
    IERC20 public SOV;
    ///@notice the staking contract address
    Staking public staking;
    
    //TODO should we use constants ?
//    constructor(
//        string memory _name,
//        string memory _symbol,
//        uint8 _decimals
//    )
//        ERC20Detailed(_name, _symbol, _decimals)
//        public
//    {
//    }
    
    constructor(
        address _SOV,
        address _staking
    )
        ERC20Detailed(NAME, SYMBOL, DECIMALS)
        public
    {
        require(_SOV != address(0), "SOV address invalid");
        require(_staking != address(0), "staking address invalid");
    
        SOV = IERC20(_SOV);
        staking = Staking(_staking);
    }
    
    function mint(uint256 _amount) public {
        //holds SOV
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);
        
        //mints RSOV tokens
        _mint(msg.sender, _amount);
    }
    
    function burn(uint256 _amount) public {
        _amount = safe96(_amount, "RSOV::burn: amount exceeds 96 bits");
        //burns RSOV tokens
        _burn(msg.sender, _amount);
        
        //stakes SOV tokens in the user's behalf
        SOV.approve(address(staking), amount);
        //TODO staking duration, should it be possible to update ?
        uint until = block.timestamp + staking.MAX_DURATION();
        staking.stake(_amount, until, msg.sender, msg.sender);
    }

}
