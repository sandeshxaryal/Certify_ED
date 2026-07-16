// 2_deploy_certification.js
const Certification = artifacts.require("Certification");
const fs = require('fs');
const path = require('node:path');

module.exports = async function (deployer) {
  try {
    await deployer.deploy(Certification);
    const instance = await Certification.deployed();

    // Ensure build directory exists
    const buildDir = path.join(__dirname, '../build/contracts');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // Write deployment config
    const config = {
      Certification: instance.address,
      networkId: await web3.eth.net.getId()
    };

    fs.writeFileSync(
      path.join(buildDir, 'deployment_config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log('Contract deployed at:', instance.address);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};