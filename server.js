// server.js - Roblox Anime Generator API Server
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Enable CORS for Roblox
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// CONFIGURATION
// You need to get API key from: https://replicate.com/account/api-tokens
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || 'YOUR_API_KEY_HERE';

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Roblox Anime Generator API',
    timestamp: new Date().toISOString(),
    endpoints: {
      generate: 'POST /generate-anime',
      health: 'GET /health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Main generation endpoint
app.post('/generate-anime', async (req, res) => {
  console.log('=================================');
  console.log('New generation request received');
  console.log('User:', req.body.userName);
  console.log('Prompt:', req.body.prompt);
  console.log('=================================');
  
  const { prompt, negative_prompt, width, height, steps, userId, userName } = req.body;
  
  // Validate request
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Missing prompt parameter',
      message: 'Invalid request'
    });
  }
  
  try {
    console.log('Calling Replicate API...');
    
    // Create prediction
    const response = await axios.post(
      REPLICATE_API,
      {
        version: 'cjwbw/anything-v3.0:f410ed4c6a0c3bf8b76747860b3a3c9e4c8b5a827a16eac9dd5ad9642edce9a2',
        input: {
          prompt: prompt,
          negative_prompt: negative_prompt || 'low quality, blurry, ugly',
          width: width || 512,
          height: height || 512,
          num_inference_steps: steps || 25,
          guidance_scale: 7.5,
          num_outputs: 1,
          scheduler: 'DPMSolverMultistep'
        }
      },
      {
        headers: {
          'Authorization': `Token ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Prediction created:', response.data.id);
    console.log('Status:', response.data.status);
    
    // Wait for completion
    let prediction = response.data;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes timeout
    
    while (
      prediction.status !== 'succeeded' && 
      prediction.status !== 'failed' && 
      prediction.status !== 'canceled' &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await axios.get(
        `${REPLICATE_API}/${prediction.id}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_KEY}`
          }
        }
      );
      
      prediction = statusResponse.data;
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`Generating... ${attempts}s elapsed (Status: ${prediction.status})`);
      }
    }
    
    console.log('Final status:', prediction.status);
    
    if (prediction.status === 'succeeded') {
      const imageUrl = prediction.output[0];
      console.log('✅ Image generated successfully!');
      console.log('Image URL:', imageUrl);
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        robloxAssetId: null,
        message: 'Anime avatar generated successfully!',
        metadata: {
          userId: userId,
          userName: userName,
          generationTime: attempts
        }
      });
      
      console.log('Response sent to client');
      
    } else if (prediction.status === 'failed') {
      console.error('❌ Generation failed:', prediction.error);
      res.status(500).json({
        success: false,
        error: prediction.error || 'Generation failed',
        message: 'Failed to generate image. Please try again.'
      });
      
    } else {
      console.error('⏱️ Generation timed out');
      res.status(504).json({
        success: false,
        error: 'Timeout',
        message: 'Generation took too long. Please try again.'
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      
      if (error.response.status === 401) {
        return res.status(500).json({
          success: false,
          error: 'Invalid API key',
          message: 'Server configuration error. Please contact admin.'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Server error occurred. Please try again.'
    });
  }
});

// Test endpoint (doesn't use real AI, for testing)
app.post('/generate-test', (req, res) => {
  console.log('Test generation request');
  
  // Return a test anime image URL
  res.json({
    success: true,
    imageUrl: 'https://replicate.delivery/pbxt/example-anime.png',
    robloxAssetId: null,
    message: 'Test image generated!'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('🎨 ROBLOX ANIME GENERATOR API SERVER');
  console.log('='.repeat(50));
  console.log('');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  / - Server info`);
  console.log(`  GET  /health - Health check`);
  console.log(`  POST /generate-anime - Generate anime image`);
  console.log(`  POST /generate-test - Test endpoint`);
  console.log('');
  console.log('API Key configured:', REPLICATE_API_KEY !== 'YOUR_API_KEY_HERE' ? '✅ Yes' : '❌ No (update required)');
  console.log('');
  console.log('='.repeat(50));
  console.log('');
});