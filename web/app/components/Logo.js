export default function Logo() {
    return (
        <div className="flex items-center gap-4 select-none group">
            <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 rounded-2xl"></div>
                <svg className="w-7 h-7 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                    File Organizer
                </h1>
                <div className="flex items-center gap-2">
                    <span className="h-px w-6 bg-purple-300"></span>
                    <p className="text-xs font-bold text-purple-600 tracking-widest uppercase">OS Concepts Demo</p>
                </div>
            </div>
        </div>
    );
}
