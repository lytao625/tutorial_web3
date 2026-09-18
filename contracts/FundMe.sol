//SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/* 完成一个融资智能合约，实现如下功能：
** 1. 创建一个融资收款函数
** 2. 记录投资人并查看
** 3. 在锁定期内，到达目标值，创业者可以提款
** 4. 在锁定期内，未到达目标值，投资人在锁定期内退款
*/

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract FundMe {
    // 记录投资人和投资资金额
    mapping(address => uint256) public fundersToAmount;
    
    // 记录合约所属者
    address public owner;

    // 定义目标融资金额（USD）
    uint256 constant TARGET = 1000 * 10 ** 18;
    // 定义最小投资金额（USD）
    uint256 constant MINIMUM_VALUE = 100 * 10 ** 18;

    // ETH:USD价格转换数据源
    AggregatorV3Interface private dataFeed;    

    event fundEvent(address indexed inventor, address indexed to, uint256 amount);

    constructor(address dataFeedAddress) {
        owner = msg.sender;
        dataFeed = AggregatorV3Interface(dataFeedAddress);
    }

    /**
    * Returns the latest answer.
    */
    function getChainlinkDataFeedLatestAnswer() public view returns (int256) {
        // prettier-ignore
        (
            /* uint80 roundId */
            ,
            int256 answer,
            /*uint256 startedAt*/
            ,
            /*uint256 updatedAt*/
            ,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }

    // 获取实时的USD价格，并把ETH转化为实时的USD
    function convertETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        uint256 ethPrice = uint256(getChainlinkDataFeedLatestAnswer());
        return ethAmount * ethPrice / (10 ** 8);
    } 

    // 融资收款函数
    function fund() external payable{
        require(convertETHtoUSD(msg.value) >= MINIMUM_VALUE, "More eth needed");
        fundersToAmount[msg.sender] += msg.value;
        emit fundEvent(msg.sender, address(this), msg.value);
    }
}