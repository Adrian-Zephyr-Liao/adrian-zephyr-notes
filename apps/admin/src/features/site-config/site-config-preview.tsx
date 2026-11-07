import type { UpdateAdminSiteSettingsRequest } from "@adrian-zephyr-notes/contracts";
import { ArrowRight, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

function SiteConfigPreview({ settings }: { settings: UpdateAdminSiteSettingsRequest }) {
  const [mobile, setMobile] = useState(false);
  const navigation = settings.navigationItems
    .filter((item) => item.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const socialLinks = settings.socialLinks
    .filter((item) => item.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <aside aria-label="配置预览" className="min-w-0 xl:sticky xl:top-6 xl:self-start">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <h2 className="font-display text-lg font-semibold">配置预览</h2>
          <p className="mt-1 text-xs text-muted-foreground">即时展示当前编辑内容</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="预览尺寸">
          <Button
            aria-pressed={!mobile}
            variant={!mobile ? "default" : "outline"}
            size="sm"
            onClick={() => setMobile(false)}
          >
            <Monitor />
            桌面
          </Button>
          <Button
            aria-pressed={mobile}
            variant={mobile ? "default" : "outline"}
            size="sm"
            onClick={() => setMobile(true)}
          >
            <Smartphone />
            手机
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-muted/45 p-2 sm:p-3">
        <div
          className={cn(
            "mx-auto overflow-hidden border border-[#d4dacf] bg-[#faf7ef] text-[#263e3d] transition-[max-width] duration-200 motion-reduce:transition-none",
            mobile ? "max-w-80" : "max-w-full",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d4dacf] p-5 sm:px-7">
            <p className="font-display text-2xl font-semibold tracking-tight">AZ Notes</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {navigation.map((item) => (
                <span key={item.id} title={item.href}>
                  {item.label || "未命名导航"}
                </span>
              ))}
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <div
              className={cn(
                "grid items-center gap-6",
                !mobile && "min-[1350px]:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]",
              )}
            >
              <div className="min-w-0">
                <p className="mb-4 text-[10px] tracking-widest text-[#67716b]">
                  {settings.home.eyebrow || "首页眉标"}
                </p>
                <h3 className="font-display text-3xl/relaxed font-semibold wrap-anywhere whitespace-pre-line">
                  {settings.home.title || "首页标题"}
                </h3>
                <p className="mt-5 text-xs/7 wrap-anywhere whitespace-pre-line">
                  {settings.home.subtitle || "首页介绍"}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <span
                    className="inline-flex items-center gap-2 rounded-sm bg-[#26735f] px-3 py-2 text-xs text-[#fffaf0]"
                    title={settings.home.primaryActionHref}
                  >
                    {settings.home.primaryActionLabel || "主按钮"}
                    <ArrowRight className="size-3" />
                  </span>
                  {settings.home.secondaryActionLabel ? (
                    <span
                      className="text-xs underline underline-offset-4"
                      title={settings.home.secondaryActionHref ?? undefined}
                    >
                      {settings.home.secondaryActionLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <figure className="min-w-0">
                <img
                  alt="用于配置预览的编辑室示意摄影"
                  src="/images/editorial-stairway.webp"
                  className={cn("w-full object-cover", mobile ? "aspect-4/3" : "aspect-3/4")}
                />
                <figcaption className="mt-2 text-[9px] text-[#67716b]">编辑室示意图</figcaption>
              </figure>
            </div>
            <div className="mt-8 border-t border-[#d4dacf] pt-5">
              <p className="text-xs font-medium">找到我</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#67716b]">
                {socialLinks.length ? (
                  socialLinks.map((item) => (
                    <span key={item.id} title={item.href}>
                      {item.label || "未命名链接"}
                    </span>
                  ))
                ) : (
                  <span>尚未启用社交链接</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px]/6 text-muted-foreground">
        此处为配置预览。修改保存前不会写入站点，示意图不属于站点配置。
      </p>
    </aside>
  );
}

export { SiteConfigPreview };
