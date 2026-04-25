import { useState, useEffect } from 'react';
import { Store, TrendingUp, MapPin, CheckCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function NiagaView() {
    const [products, setProducts] = useState([
        { id: 1, seller: "Nelayan Tumpat Koperasi", badge: true, item: "Fresh Siakap (50kg Bulk)", price: "RM 25/kg", location: "Pengkalan Kubor", time: "20 mins ago", type: "Seafood" },
        { id: 2, seller: "Ladang Sayur Lojing", badge: true, item: "Organic Cabbage (100kg)", price: "RM 3.50/kg", location: "Lojing Highlands", time: "1 hour ago", type: "Produce" },
        { id: 3, seller: "Pak Ali Livestock", badge: false, item: "Kampung Chicken (20 birds)", price: "RM 18/bird", location: "Pasir Mas", time: "3 hours ago", type: "Poultry" },
    ]);

    // Simulate Real-time WebSocket updates
    useEffect(() => {
        const sellers = ["Kebun Kota D'Raja", "Pasar Siti Khadijah", "Tani Jaya", "Warisan Desa"];
        const items = ["Local Grade A Beras", "Red Chillies (Grade B)", "Duck Eggs (x50)", "Ginger (Bentong)"];

        const interval = setInterval(() => {
            const newItem = {
                id: Date.now(),
                seller: sellers[Math.floor(Math.random() * sellers.length)],
                badge: Math.random() > 0.5,
                item: items[Math.floor(Math.random() * items.length)],
                price: `RM ${(Math.random() * 50 + 5).toFixed(2)}/unit`,
                location: "Kota Bharu",
                time: "Just now",
                type: "General"
            };

            setProducts(prev => [newItem, ...prev.slice(0, 4)]);
        }, 8000); // New supply every 8 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6"
            >
                <h2 className="text-3xl font-serif text-white tracking-tight mb-1">Nadi-Niaga</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367]">
                    Hyper-Local B2B Supply Chain
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 rounded-3xl p-6 mb-6 border border-[#10B981]/20 shadow-xl shadow-[#10B981]/10 inset-0 backdrop-blur-sm relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4 relative z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Weekly Volume</p>
                        <p className="text-3xl font-light text-[#FAFAFA] tracking-tight">RM 48,200</p>
                    </div>
                    <div className="bg-[#10B981]/20 text-[#10B981] p-3 rounded-2xl border border-[#10B981]/30 shadow-inner">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </div>
                <p className="text-[11px] text-[#10B981]/80 font-medium leading-relaxed relative z-10">
                    <span className="font-bold text-zinc-300">NADI</span> takes a 2% transaction fee for verified B2B matching. Connecting local producers directly to retailers.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="relative mb-6 group"
            >
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-zinc-500 group-focus-within:text-[#C5A367] transition-colors" />
                </div>
                <input
                    type="text"
                    placeholder="Search local supply (e.g., 'Siakap', 'Beras')..."
                    className="w-full bg-[#121214] pl-12 pr-4 py-4 rounded-xl shadow-inner border border-zinc-800 focus:border-[#C5A367]/50 focus:ring-1 focus:ring-[#C5A367] outline-none transition-all placeholder:text-zinc-600 text-sm font-medium text-white"
                />
            </motion.div>

            <div className="flex-1 pb-10">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="flex items-center justify-between mb-4 px-1"
                >
                    <h3 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Live Supply Log</h3>
                    <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-1.5 rounded-lg shadow-sm tracking-widest">8 NEW</span>
                </motion.div>

                <AnimatePresence initial={false}>
                    {products.map((product, index) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="bg-[#0A0A0C] rounded-3xl p-5 shadow-lg border border-zinc-800/80 hover:border-zinc-700 transition-colors relative overflow-hidden group hover:bg-[#121214]"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">{product.time}</span>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 shrink-0 group-hover:bg-zinc-800 transition-colors">
                                    <Store className="w-4 h-4 text-[#C5A367]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                                        {product.seller}
                                        {product.badge && <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />}
                                    </h4>
                                </div>
                            </div>

                            <div className="pl-13">
                                <h5 className="text-lg font-serif text-white mb-2 group-hover:text-[#C5A367] transition-colors">{product.item}</h5>
                                <p className="text-xl font-light text-zinc-300 mb-4">{product.price}</p>

                                <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-2">
                                    <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-zinc-500">
                                        <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                                        {product.location}
                                    </div>
                                    <button className="bg-[#121214] hover:bg-[#1A1A1E] text-white px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all shadow-md shadow-black/40 active:scale-95 border border-zinc-700 hover:border-zinc-500 group-hover:text-[#10B981]">
                                        Acquire
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
