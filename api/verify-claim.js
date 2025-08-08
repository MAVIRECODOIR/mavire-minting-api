export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, claimToken } = req.body;

  try {
    // Your verification logic here
    // Check if the claim token exists and matches the email
    // Return order details
    
    const orderData = {
      orderId: 'found-order-id',
      productName: 'Product name from Shopify',
      customerName: 'Customer name',
      orderDate: 'Order date',
      price: 'Order price'
    };

    res.status(200).json(orderData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
