// Voice Command Configuration
// Add new phrases here to make Luma understand them.
// Ensure they are lowercased.

export const VOICE_PHRASES = {
    // Commands to START cooling an item
    startCooling: [
        "start cooling",
        "begin cooling",
        "start cool",
        "cool",
        "cooling",
        "new cooling"
    ],

    // Commands to STOP cooling an item
    stopCooling: [
        "stop cooling",
        "finish cooling",
        "cooling done",
        "cooling finished",
        "cooling complete",
        "done cooling",
        "finish"
    ],

    // Commands to LOG FRIDGE temperatures
    logFridge: [
        "log fridge",
        "log refrigerator",
        "log freezer",
        "check fridge",
        "check refrigerator",
        "record fridge",
        "fridge temp",
        "freezer temp"
    ],

    // Commands to DISCARD an item
    discard: [
        "discard",
        "throw away",
        "throw out",
        "bin",
        "trash",
        "waste"
    ]
} as const
