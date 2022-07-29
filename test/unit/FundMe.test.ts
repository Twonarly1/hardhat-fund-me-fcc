import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { assert, expect } from "chai"
import { network, deployments, ethers } from "hardhat"
import { developmentChains } from "../../helper-hardhat-config"
import { FundMe, MockV3Aggregator } from "../../typechain-types"

describe("FundMe", async function () {
    let fundMe: FundMe
    let deployer: SignerWithAddress
    let MockV3Aggregator: MockV3Aggregator
    const sendValue = ethers.utils.parseEther("1")

    beforeEach(async function () {
        if (!developmentChains.includes(network.name)) {
            throw "You need to be on a development chain to run tests"
        }
        const accounts = await ethers.getSigners()
        deployer = accounts[0]
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe")
        MockV3Aggregator = await ethers.getContract("MockV3Aggregator")
    })

    describe("constructor", function () {
        it("sets the aggregator addresses correctly", async () => {
            const response = await fundMe.getPriceFeed()
            assert.equal(response, MockV3Aggregator?.address)
        })
    })

    describe("fund", function () {
        it("Fails if you don't send enough ETH", async () => {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            )
        })
        it("updated the amount funded data structure", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getAddressToAmountFunded(
                deployer?.address
            )
            assert.equal(response.toString(), sendValue.toString())
        })
        it("Adds funder to array of getFunder", async () => {
            await fundMe.fund({ value: sendValue })
            const funder = await fundMe.getFunder(0)
            assert.equal(funder, deployer?.address)
        })
    })
    describe("withdraw", async () => {
        beforeEach(async () => {
            await fundMe.fund({ value: sendValue })
        })
        it("withdraw ETH from a single funder", async () => {
            // Arrange
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )
            // Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )
            // Assert
            assert.equal(endingFundMeBalance.toString(), "0")
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            )
        })
        it("allows us to withdraw with multiple funder", async () => {
            const accounts = await ethers.getSigners()
            for (let i = 1; i < 6; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )

            //Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )
            // Assert
            assert.equal(endingFundMeBalance.toString(), "0")
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            )

            //Mae sure that the getFunder are reset properly
            await expect(fundMe.getFunder(0)).to.be.reverted

            for (let i = 1; i < 6; i++) {
                assert.equal(
                    await (
                        await fundMe.getAddressToAmountFunded(
                            accounts[i]?.address
                        )
                    ).toString(),
                    "0"
                )
            }
        })
        it("Only allows the owner to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const fundMeConnectedContract = await fundMe.connect(accounts[1])
            await expect(fundMeConnectedContract.withdraw()).to.be.revertedWith(
                "FundMe__NotOwner"
            )
        })

        it("cheaperWithdraw testing...", async () => {
            const accounts = await ethers.getSigners()
            for (let i = 1; i < 6; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }
            const startingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const startingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )

            //Act
            //@ts-ignore
            const transactionResponse = await fundMe.cheaperWithdraw()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await fundMe.provider.getBalance(
                fundMe?.address
            )
            const endingDeployerBalance = await fundMe.provider.getBalance(
                deployer?.address
            )
            // Assert
            assert.equal(endingFundMeBalance.toString(), "0")
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString()
            )

            //Mae sure that the s-funder are reset properly
            await expect(fundMe.getFunder(0)).to.be.reverted

            for (let i = 1; i < 6; i++) {
                assert.equal(
                    await (
                        await fundMe.getAddressToAmountFunded(
                            accounts[i]?.address
                        )
                    ).toString(),
                    "0"
                )
            }
        })
    })
})
