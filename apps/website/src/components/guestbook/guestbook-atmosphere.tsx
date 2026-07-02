import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const shimmerDots = [
  "left-[7%] top-[14%] size-1 [animation-delay:0.1s]",
  "left-[10%] top-[28%] size-0.5 [animation-delay:2.2s]",
  "left-[15%] top-[42%] size-1.5 [animation-delay:1.7s]",
  "left-[18%] top-[9%] size-1 [animation-delay:3.1s]",
  "left-[23%] top-[18%] size-1 [animation-delay:0.9s]",
  "left-[27%] top-[52%] size-0.5 [animation-delay:4.4s]",
  "left-[31%] top-[66%] size-1 [animation-delay:2.4s]",
  "left-[36%] top-[38%] size-1 [animation-delay:0.3s]",
  "left-[41%] top-[27%] size-1.5 [animation-delay:1.1s]",
  "left-[45%] top-[76%] size-1 [animation-delay:3.7s]",
  "left-[52%] top-[12%] size-1 [animation-delay:3.2s]",
  "left-[55%] top-[44%] size-0.5 [animation-delay:1.4s]",
  "left-[61%] top-[58%] size-1.5 [animation-delay:0.4s]",
  "left-[64%] top-[24%] size-1 [animation-delay:5.1s]",
  "left-[69%] top-[72%] size-0.5 [animation-delay:2.9s]",
  "left-[74%] top-[22%] size-1 [animation-delay:2.8s]",
  "left-[79%] top-[8%] size-1.5 [animation-delay:4.8s]",
  "left-[83%] top-[48%] size-1.5 [animation-delay:1.9s]",
  "left-[87%] top-[67%] size-1 [animation-delay:0.8s]",
  "left-[92%] top-[16%] size-1 [animation-delay:0.7s]",
  "left-[95%] top-[36%] size-0.5 [animation-delay:3.5s]",
  "left-[6%] top-[76%] size-1 [animation-delay:5.7s]",
  "left-[21%] top-[84%] size-1.5 [animation-delay:4.1s]",
  "left-[39%] top-[7%] size-0.5 [animation-delay:2.6s]",
  "left-[58%] top-[86%] size-1 [animation-delay:1.2s]",
  "left-[72%] top-[41%] size-0.5 [animation-delay:6.2s]",
  "left-[88%] top-[83%] size-1 [animation-delay:2.1s]",
  "left-[97%] top-[62%] size-1.5 [animation-delay:5.3s]",
];

const mailTrails = [
  "left-[82%] top-[9%] w-36 [--trail-angle:-28deg] [--trail-distance:42rem] [--trail-duration:5.2s] [--trail-fall:15rem] [animation-delay:0.2s]",
  "left-[67%] top-[18%] w-28 [--trail-angle:-31deg] [--trail-distance:34rem] [--trail-duration:6.4s] [--trail-fall:12rem] [animation-delay:1.4s]",
  "left-[94%] top-[31%] w-32 [--trail-angle:-27deg] [--trail-distance:46rem] [--trail-duration:5.9s] [--trail-fall:17rem] [animation-delay:2.1s]",
  "left-[48%] top-[6%] w-24 [--trail-angle:-30deg] [--trail-distance:28rem] [--trail-duration:7.1s] [--trail-fall:10rem] [animation-delay:2.9s]",
  "left-[76%] top-[58%] w-28 [--trail-angle:-25deg] [--trail-distance:36rem] [--trail-duration:6.8s] [--trail-fall:12rem] [animation-delay:3.8s]",
  "left-[58%] top-[35%] w-22 [--trail-angle:-33deg] [--trail-distance:32rem] [--trail-duration:7.6s] [--trail-fall:13rem] [animation-delay:4.6s]",
  "left-[101%] top-[4%] w-40 [--trail-angle:-29deg] [--trail-distance:54rem] [--trail-duration:6.1s] [--trail-fall:19rem] [animation-delay:5.5s]",
  "left-[38%] top-[22%] w-20 [--trail-angle:-24deg] [--trail-distance:26rem] [--trail-duration:8.2s] [--trail-fall:9rem] [animation-delay:6.3s]",
  "left-[90%] top-[72%] w-30 [--trail-angle:-32deg] [--trail-distance:42rem] [--trail-duration:7.3s] [--trail-fall:16rem] [animation-delay:7.1s]",
  "left-[71%] top-[2%] w-24 [--trail-angle:-26deg] [--trail-distance:30rem] [--trail-duration:6.9s] [--trail-fall:11rem] [animation-delay:7.9s]",
  "left-[56%] top-[80%] w-18 [--trail-angle:-29deg] [--trail-distance:28rem] [--trail-duration:8.8s] [--trail-fall:10rem] [animation-delay:8.6s]",
  "left-[97%] top-[46%] w-34 [--trail-angle:-28deg] [--trail-distance:48rem] [--trail-duration:6.5s] [--trail-fall:18rem] [animation-delay:9.4s]",
];

function GuestbookAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className={cn(styles.atmosphere, "pointer-events-none fixed inset-0 z-0 overflow-hidden")}
    >
      <div className={cn(styles.particleField, "absolute inset-0")} />
      <div className={cn(styles.skyVignette, "absolute inset-0")} />

      {shimmerDots.map((className) => (
        <span
          key={className}
          className={cn(styles.shimmerDot, "absolute rounded-full bg-primary/45", className)}
        />
      ))}

      {mailTrails.map((className) => (
        <span
          key={className}
          className={cn(styles.mailTrail, "absolute h-px origin-right rounded-full", className)}
        />
      ))}
    </div>
  );
}

export { GuestbookAtmosphere };
