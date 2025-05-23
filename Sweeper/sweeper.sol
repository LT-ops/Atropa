// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITT {
    function Claim(address Contract, uint256 Amount) external;
    function mint(uint256 amount) external;
    function Debenture() external returns (bool);
    function Parent() external returns (ERC20);
}

contract SWEEPER {
    address public owner;
    address constant PARENT = 0x1c27Fd7Ab4FAA8141119484E00D2455851639C2b;
    address constant CHILD = 0xDb4eBEAfb23eCA5275821aB0D87c7f6fa5514EA4;
    address constant BAR = 0x409ae0869f224b4d57868de4af1412e833cb2739;
    
    constructor() {
        owner = msg.sender;
    }

    function sweep(uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        
        // Transfer and approve parent token (PARENT)
        ERC20(PARENT).transferFrom(msg.sender, address(this), amount);
        if(ERC20(PARENT).allowance(address(this), CHILD) < amount) {
            ERC20(PARENT).approve(CHILD, type(uint256).max);
        }

        // Mint CHILD
        ITT(CHILD).mint(amount);
        
        // Transfer and approve BAR
        ERC20(BAR).transferFrom(msg.sender, address(this), amount);
        if(ERC20(BAR).allowance(address(this), CHILD) < amount) {
            ERC20(BAR).approve(CHILD, type(uint256).max);
        }

        // Claim and return tokens
        ITT(CHILD).Claim(BAR, amount);
        ERC20(PARENT).transfer(msg.sender, amount);
        ERC20(CHILD).transfer(msg.sender, amount);
    }

    function withdraw(address token) external {
        require(msg.sender == owner, "Not owner");
        ERC20(token).transfer(msg.sender, ERC20(token).balanceOf(address(this)));
    }
}