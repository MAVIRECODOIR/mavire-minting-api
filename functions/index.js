const express = require("express");
const cors = require("cors");
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");

const app = express();
app.use(cors());
app.use(express.json());

const CLOUDINARY_CLOUD_NAME = "dd3cjiork";
const CLOUDINARY_PUBLIC_ID = "Mavire_CoA_-_Customer_iehzb9";

app.post(async (req, res) => {
  try {
    const { email, productTitle, customerName, material, sku, shopifyOrderId } = req.body;

    if (!email || !productTitle || !customerName || !material || !sku || !shopifyOrderId) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const PRIVATE_KEY = process.env.THIRDWEB_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.THIRDWEB_CONTRACT_ADDRESS;
    const CHAIN = process.env.THIRDWEB_CHAIN;

    const sdk = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN);
    const contract = await sdk.getContract(CONTRACT_ADDRESS);

    const authenticationDate = new Date().toLocaleDateString("en-CA");
    const traceabilityId = `${sku}-${shopifyOrderId}`;
    const encode = encodeURIComponent;

    const transformations = [
      `l_text:Amiri_30:${encode(productTitle)},co_black,g_center,y_280`,
      `l_text:Amiri_30:${encode(material)},co_black,g_center,y_320`,
      `l_text:Amiri_30:${encode("Authenticated: " + authenticationDate)},co_black,g_center,y_360`,
      `l_text:Amiri_30:${encode("ID: " + traceabilityId)},co_black,g_center,y_400`
    ].join("/");

    const dynamicImageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/${CLOUDINARY_PUBLIC_ID}.jpg`;

    const metadata = {
      name: `Certificate of Authenticity – ${productTitle}`,
      description: `A unique digital certificate for ${productTitle}, verifying its materials and authenticity.`,
      image: dynamicImageUrl,
      properties: {
        buyer: customerName,
        email: email,
        product: productTitle,
        sku: sku,
        materials: material,
        authentication_date: authenticationDate,
        shopify_order_id: shopifyOrderId,
        traceability_id: traceabilityId
      }
    };

    const mintTx = await contract.erc721.mintTo(email, metadata);
    const nftLink = `https://thirdweb.com/${CHAIN}/${CONTRACT_ADDRESS}/nfts/${mintTx.id.toString()}`;

    res.status(200).json({
      success: true,
      message: "NFT minted successfully",
      nftLink,
      imageUrl: dynamicImageUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = app;
