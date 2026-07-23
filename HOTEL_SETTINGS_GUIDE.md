# Hotel Settings Feature Guide

## Overview
The Hotel Settings feature allows you to edit operational data (like check-in/check-out times) in the admin panel and automatically have these changes reflected in the chatbot responses.

## How It Works

### 1. **Data Structure**
Hotel settings are defined in `src/data/settings.ts` and include:
- **Check-in Time** (e.g., "2:00 PM")
- **Check-out Time** (e.g., "12:00 PM")
- **Front Desk Locations** (e.g., ["The Nest", "The Canopy"])
- **Restaurant Name** (e.g., "The Reserve")
- **Restaurant Hours** (e.g., "6:30 AM - 10:00 PM")
- **In-Room Dining Hours** (e.g., "6:00 AM - 11:30 PM")
- **Gym Hours** (e.g., "6:00 AM - 10:00 PM")
- **Pool Hours** (e.g., "6:00 AM - 10:00 PM")
- **Housekeeping Hours** (e.g., "9:00 AM - 5:00 PM")
- **Recreation Hours** (e.g., "8:00 AM - 11:00 PM")
- **Emergency Number** (e.g., "0")
- **WiFi Device Limit** (e.g., 4)
- **WiFi Policy** (e.g., "Free WiFi for 4 devices per room")

### 2. **Editing Settings in Admin Panel**

Follow these steps to edit hotel settings:

1. **Go to Admin Dashboard**: Navigate to `http://localhost:3000/admin` (or your domain)
2. **Sign In**: Log in with your admin credentials
3. **Go to Data Files**: Click on "Data Files" tab in the sidebar
4. **Select Hotel Settings**: In the dropdown, select "Hotel Settings"
5. **Edit JSON**: The current settings will load as JSON. Edit any values you want to change:
   ```json
   {
     "checkIn": "1:00 PM",
     "checkOut": "12:00 PM",
     "frontDeskLocations": ["The Nest", "The Canopy"],
     "restaurantName": "The Reserve",
     "restaurantHours": "6:30 AM - 10:00 PM",
     "inRoomDiningHours": "6:00 AM - 11:30 PM",
     "gymHours": "6:00 AM - 10:00 PM",
     "poolHours": "6:00 AM - 10:00 PM",
     "housekeepingHours": "9:00 AM - 5:00 PM",
     "recreationHours": "8:00 AM - 11:00 PM",
     "emergencyNumber": "0",
     "wifiDeviceLimit": 4,
     "wifiPolicy": "Free WiFi for 4 devices per room"
   }
   ```
6. **Save Changes**: Click "Save" button
7. **Changes Take Effect**: The chatbot will automatically use the new values in responses

### 3. **Example: Changing Check-in Time**

**Before:**
- Admin: Change check-in from "2:00 PM" to "1:00 PM"
- Guest: "What time is check-in?"
- Bot: "Check-in: 2:00 PM."

**After:**
- Admin edits settings: `"checkIn": "1:00 PM"`
- Admin saves changes
- Guest: "What time is check-in?"
- Bot: "Check-in: 1:00 PM." ✓

### 4. **How the Chatbot Uses Settings**

The settings are included in the AI knowledge prompt with a **"CRITICAL"** flag, ensuring the AI model prioritizes them when answering questions. The settings appear at the top of the knowledge base:

```
HOTEL SETTINGS (CRITICAL - Always use these values):
- Check-in Time: 1:00 PM
- Check-out Time: 12:00 PM
- Front Desk Locations: The Nest, The Canopy
- Emergency Number: 0
[... and more settings]
```

### 5. **What Settings Are Used For**

When guests ask the chatbot questions like:
- "What time is check-in/check-out?"
- "When does the gym open/close?"
- "What are the pool hours?"
- "How do I contact the front desk?"
- "What's the WiFi policy?"
- "Can I order room service?"

The chatbot will automatically respond using the current hotel settings from Firebase.

### 6. **Firebase Integration**

- Settings are stored in Firebase at: `siteContent/settings`
- The system automatically loads settings from Firebase when available
- If Firebase is unavailable, it falls back to default settings in `src/data/settings.ts`
- Settings are cached for 60 seconds to improve performance

### 7. **Adding New Settings**

To add new operational data:

1. Update the `HotelSettings` type in `src/data/settings.ts`
2. Add default value to `defaultSettings`
3. The admin panel will automatically support the new field
4. Update `buildKnowledgePrompt` in `src/app/api/chat/route.ts` to include the new field in the prompt

### 8. **Best Practices**

- ✅ Keep times in consistent format (e.g., "2:00 PM" or "14:00")
- ✅ Update settings whenever operational hours change
- ✅ Test the chatbot after updating settings
- ✅ Use clear, descriptive text for locations and policies
- ✅ Keep phone numbers and email addresses up to date

### 9. **Troubleshooting**

**Settings not updating?**
- Clear browser cache or hard refresh (Ctrl+Shift+R)
- Check that changes were saved successfully (look for "saved successfully" message)
- Restart the dev server or redeploy if using production

**JSON validation error?**
- Make sure all field types match (strings are in quotes, numbers without quotes)
- Ensure arrays are properly formatted: `["item1", "item2"]`
- Check for trailing commas or other JSON syntax errors

**Changes not reflecting in chatbot?**
- Wait 60 seconds for cache to refresh
- Click "Refresh Chatbot Knowledge" button in admin dashboard
- Check that Firebase is configured properly

## Files Modified

- `src/data/settings.ts` - New file with hotel settings definitions
- `src/app/admin/page.tsx` - Updated to support editing settings
- `src/app/api/chat/route.ts` - Updated to load and use settings

## Summary

You can now easily manage all operational data (check-in/check-out times, hours of operation, contact info, etc.) from a single admin panel, and changes will automatically be reflected in chatbot responses!
