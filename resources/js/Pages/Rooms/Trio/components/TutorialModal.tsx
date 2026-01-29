import { useState, useEffect } from 'react';
import Modal from '@/Components/Modal';

interface TutorialModalProps {
    show: boolean;
    onClose: () => void;
}

export default function TutorialModal({ show, onClose }: TutorialModalProps) {
    const [step, setStep] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const steps = [
        {
            title: 'Welcome to TRIO!',
            content: 'TRIO is a card game where you collect sets of three matching cards. First player to collect 3 trios wins!',
            emoji: '🎴',
        },
        {
            title: 'Revealing Cards',
            content: 'On your turn, reveal cards from the middle grid or ask other players for their highest or lowest card.',
            emoji: '👀',
        },
        {
            title: 'Making a Trio',
            content: 'When you reveal 3 cards with the same number, you can claim them as a trio! They will be added to your collection.',
            emoji: '✨',
        },
        {
            title: 'Win the Game',
            content: 'The first player to collect 3 trios wins! If cards don\'t match, end your turn and the next player goes.',
            emoji: '🏆',
        },
    ];

    const currentStep = steps[step];

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('trio_tutorial_seen', 'true');
        }
        onClose();
    };

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="lg">
            <div className="bg-white p-8 rounded-lg">
                {/* Progress indicator */}
                <div className="flex gap-2 mb-6">
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`flex-1 h-2 rounded-full transition-all ${
                                idx <= step ? 'bg-blue-500' : 'bg-gray-200'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">{currentStep.emoji}</div>
                    <h2 className="text-2xl font-black text-gray-900 mb-3">
                        {currentStep.title}
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed">
                        {currentStep.content}
                    </p>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-4">
                    <button
                        onClick={handlePrev}
                        disabled={step === 0}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
                    >
                        ← Previous
                    </button>

                    <span className="text-sm text-gray-500 font-medium">
                        {step + 1} / {steps.length}
                    </span>

                    <button
                        onClick={handleNext}
                        className="px-6 py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600 transition"
                    >
                        {step < steps.length - 1 ? 'Next →' : 'Got it!'}
                    </button>
                </div>

                {/* Don't show again */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <label className="flex items-center justify-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <span>Don't show this again</span>
                    </label>
                </div>
            </div>
        </Modal>
    );
}
