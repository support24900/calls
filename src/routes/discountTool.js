const express = require('express');
const router = express.Router();

// Vapi server-side tool: create a personalized Shopify discount code
router.post('/create-discount', async (req, res) => {
  try {
    // Vapi sends tool calls in message format
    const toolCall = req.body?.message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments || req.body;
    
    const customerName = (args.customerName || 'CUSTOMER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const discountPercent = Math.min(Math.max(parseInt(args.discountPercent) || 15, 5), 25); // 5-25% range
    const cartTotal = parseFloat(args.cartTotal) || 0;
    
    // Generate unique code: MIRAI-{NAME}-{PERCENT}-{RANDOM}
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `MIRAI-${customerName.substring(0, 8)}-${discountPercent}-${randomPart}`;
    
    // Determine discount logic:
    // Cart > $100: up to 20%
    // Cart > $75: up to 15%  
    // Cart > $50: up to 12%
    // Cart < $50: up to 10%
    let maxDiscount = 10;
    if (cartTotal >= 100) maxDiscount = 20;
    else if (cartTotal >= 75) maxDiscount = 15;
    else if (cartTotal >= 50) maxDiscount = 12;
    
    const finalPercent = Math.min(discountPercent, maxDiscount);
    const finalCode = `MIRAI-${customerName.substring(0, 8)}-${finalPercent}-${randomPart}`;
    
    // Create discount via Shopify Admin API
    const shopifyUrl = process.env.SHOPIFY_STORE_URL || 'https://9dkd2w-g3.myshopify.com';
    const storeUrl = shopifyUrl.includes('myshopify.com') ? shopifyUrl : 'https://9dkd2w-g3.myshopify.com';
    
    const discountPayload = {
      price_rule: {
        title: finalCode,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "percentage",
        value: `-${finalPercent}`,
        customer_selection: "all",
        usage_limit: 1,
        once_per_customer: true,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
      }
    };
    
    // Step 1: Create price rule
    const priceRuleRes = await fetch(`${storeUrl}/admin/api/2024-01/price_rules.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify(discountPayload),
    });
    
    if (!priceRuleRes.ok) {
      const err = await priceRuleRes.text();
      console.error('Shopify price rule error:', err);
      // Fall back to a generic code
      return res.json({
        results: [{
          toolCallId: toolCall?.id,
          result: JSON.stringify({
            success: false,
            fallbackCode: 'welcome10',
            fallbackPercent: 10,
            message: `I wasn't able to create a custom code, but you can use welcome10 for 10% off!`
          })
        }]
      });
    }
    
    const priceRule = await priceRuleRes.json();
    const priceRuleId = priceRule.price_rule.id;
    
    // Step 2: Create discount code for this price rule
    const discountCodeRes = await fetch(`${storeUrl}/admin/api/2024-01/price_rules/${priceRuleId}/discount_codes.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        discount_code: { code: finalCode }
      }),
    });
    
    if (!discountCodeRes.ok) {
      const err = await discountCodeRes.text();
      console.error('Shopify discount code error:', err);
      return res.json({
        results: [{
          toolCallId: toolCall?.id,
          result: JSON.stringify({
            success: false,
            fallbackCode: 'welcome10',
            fallbackPercent: 10,
            message: `I wasn't able to create a custom code, but you can use welcome10 for 10% off!`
          })
        }]
      });
    }
    
    console.log(`Discount created: ${finalCode} (${finalPercent}% off) for ${customerName}, cart $${cartTotal}`);
    
    res.json({
      results: [{
        toolCallId: toolCall?.id,
        result: JSON.stringify({
          success: true,
          code: finalCode,
          percent: finalPercent,
          expiresIn: '72 hours',
          message: `Great news! I've created a special ${finalPercent}% discount just for you! Your code is ${finalCode}. It's valid for the next 72 hours.`
        })
      }]
    });
    
  } catch (err) {
    console.error('Discount creation error:', err.message);
    res.json({
      results: [{
        toolCallId: req.body?.message?.toolCalls?.[0]?.id,
        result: JSON.stringify({
          success: false,
          fallbackCode: 'welcome10',
          fallbackPercent: 10,
          message: `I can offer you our welcome10 code for 10% off your order!`
        })
      }]
    });
  }
});

module.exports = router;
