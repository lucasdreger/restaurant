import { describe, it, expect } from 'vitest'
import { parseVoiceCommand } from '@/lib/voiceCommands'

describe('VoiceCommands Parser - ASR Fallbacks', () => {
    it('understands "start cooling pasta"', () => {
        expect(parseVoiceCommand('start cooling pasta')).toEqual({ type: 'start_cooling', item: 'Pasta' })
    })

    it('understands "Startkulling pasta"', () => {
        expect(parseVoiceCommand('Startkulling pasta')).toEqual({ type: 'start_cooling', item: 'Pasta' })
    })

    it('understands "hey Luma start pulling pasta"', () => {
        expect(parseVoiceCommand('hey Luma start pulling pasta')).toEqual({ type: 'start_cooling', item: 'Pasta' })
    })

    it('understands "hey Luma finish pulling pasta"', () => {
        expect(parseVoiceCommand('hey Luma finish pulling pasta')).toEqual({ type: 'stop_cooling', item: 'pasta' })
    })

    it('understands "Start blien pasta"', () => {
        expect(parseVoiceCommand('Start blien pasta')).toEqual({ type: 'start_cooling', item: 'Pasta' })
    })

    it('understands cooking start commands', () => {
        expect(parseVoiceCommand('Luma, start cooking bolognese sauce')).toEqual({
            type: 'start_cooking',
            item: 'Bolognese Sauce',
        })
    })

    it('understands item-specific cooking completion commands', () => {
        expect(parseVoiceCommand('hey luma finish cooking tomato sauce')).toEqual({
            type: 'complete_cooking',
            item: 'Tomato Sauce',
        })
    })

    it('understands reheating completion commands with temperature', () => {
        expect(parseVoiceCommand('reheat complete at 76 degrees')).toEqual({
            type: 'complete_reheating',
            temperature: 76,
        })
    })

    it('understands hot hold start commands', () => {
        expect(parseVoiceCommand('start hot hold for vegetable soup')).toEqual({
            type: 'start_hot_hold',
            item: 'Vegetable Soup',
        })
    })

    it('understands hot hold temperature checks', () => {
        expect(parseVoiceCommand('soup is at 65 degrees')).toEqual({
            type: 'log_hot_hold_check',
            temperature: 65,
            item: 'soup',
        })
    })
})
