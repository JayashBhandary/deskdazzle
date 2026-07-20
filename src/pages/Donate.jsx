import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PRESETS = [
  { label: '💰₹5', value: 5 },
  { label: '💸₹50', value: 50 },
  { label: '🤑₹500', value: 500 },
  { label: '🏦₹1000', value: 1000 },
];

function Donate() {
    const [amount, setAmount] = useState(5);

    const handleAmount = (event) => {
        setAmount(event.target.value);
    }

    const shareUpiId = async () => {
        try {
            await navigator.share({ text: '9136007794@fam' });
        } catch (error) {
            toast.error(String(error?.message || error));
        }
    };

    return (
        <div className='mx-auto w-full max-w-4xl px-4 py-8 sm:px-6'>
            <header className='mb-6'>
                <h1 className='text-2xl font-semibold tracking-tight'>🙌 Donate</h1>
                <p className='mt-1 text-sm text-muted-foreground'>Support DeskDazzle — every rupee helps keep it free.</p>
            </header>

            <div className='grid gap-6 md:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>Scan to donate</CardTitle>
                        <CardDescription>Scan the QR Code to donate. Thank you!!!</CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col items-center gap-5'>
                        <button
                            type='button'
                            className='rounded-xl border bg-white p-3 transition-opacity hover:opacity-90'
                            onClick={shareUpiId}
                            aria-label='Share UPI ID'
                        >
                            <QRCodeSVG
                                value={`upi://pay?pa=9136007794@fam&pn=DeskDazzle&am=${amount}`}
                                size={200}
                            />
                        </button>
                        <div className='flex items-center gap-4'>
                            <Button variant='outline' size='icon' onClick={() => setAmount(Number(amount) + 1)} aria-label='Increase amount'>
                                <Plus />
                            </Button>
                            <span className='min-w-20 text-center text-3xl font-bold tabular-nums'>₹{amount}</span>
                            <Button variant='outline' size='icon' onClick={() => setAmount(amount - 1)} aria-label='Decrease amount'>
                                <Minus />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Choose an amount</CardTitle>
                        <CardDescription>Pick a preset or slide to a custom amount.</CardDescription>
                    </CardHeader>
                    <CardContent className='flex h-full flex-col justify-center gap-6'>
                        <div className='flex flex-wrap justify-center gap-2'>
                            {PRESETS.map((p) => (
                                <Button
                                    key={p.value}
                                    variant={Number(amount) === p.value ? 'default' : 'secondary'}
                                    className='text-base'
                                    onClick={() => setAmount(p.value)}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                        <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                            <span className='shrink-0'>₹1</span>
                            <input
                                type='range'
                                className='h-2 w-full cursor-pointer accent-primary'
                                onChange={handleAmount}
                                value={amount}
                                min='1'
                                max='4000'
                                aria-label='Custom donation amount'
                            />
                            <span className='shrink-0'>₹4000</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default Donate
