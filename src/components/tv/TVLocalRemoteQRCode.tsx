type TVLocalRemoteQRCodeProps = {
  remoteUrl: string;
  compact?: boolean;
  focusUp?: string;
  focusDown?: string;
};

export default function TVLocalRemoteQRCode({
  remoteUrl,
  compact = false,
  focusUp,
  focusDown,
}: TVLocalRemoteQRCodeProps) {
  return (
    <figure
      tabIndex={0}
      data-tv-local-remote-qr
      data-tv-focus-up={focusUp}
      data-tv-focus-down={focusDown}
      aria-label='手机扫码打开遥控器'
      className='relative z-0 shrink-0 scroll-mt-40 scroll-mb-28 rounded-[32px] border border-white/20 bg-white p-4 text-slate-950 shadow-2xl shadow-black/40 outline-none transition duration-200 focus:z-30 focus:scale-[1.04] focus:ring-4 focus:ring-rose-400 focus-visible:z-30 focus-visible:scale-[1.04] focus-visible:ring-4 focus-visible:ring-rose-400'
    >
      <img
        src={`/api/auth/qr/image?data=${encodeURIComponent(remoteUrl)}`}
        alt='局域网遥控地址二维码'
        className={`${compact ? 'h-44 w-44' : 'h-64 w-64'} rounded-2xl`}
      />
      <figcaption
        className={`${compact ? 'text-sm' : 'text-base'} mt-3 text-center font-black text-slate-950`}
      >
        手机扫码打开遥控器
      </figcaption>
    </figure>
  );
}
