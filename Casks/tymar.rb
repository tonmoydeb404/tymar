cask "tymar" do
  arch arm: "aarch64"

  version "0.2.3"
  sha256 "efec3157ff8e582460e3d424e7e3d5344a725d305f223ff819f6f65ae75772aa"

  url "https://github.com/tonmoydeb404/tymar/releases/download/v#{version}/Tymar_#{version}_#{arch}.dmg"
  name "Tymar"
  desc "Effortless time tracking for focused work."
  homepage "https://github.com/tonmoydeb404/tymar"

  depends_on macos: :big_sur
  depends_on arch: :arm64

  app "Tymar.app"

  # Unsigned/un-notarized build: strip the quarantine flag Gatekeeper adds on download.
  postflight do
    system_command "/usr/bin/xattr",
                    args: ["-cr", "#{appdir}/Tymar.app"]
  end

  zap trash: [
    "~/Library/Application Support/com.tonmoydeb.tymar",
    "~/Library/Caches/com.tonmoydeb.tymar",
    "~/Library/Preferences/com.tonmoydeb.tymar.plist",
    "~/Library/Saved Application State/com.tonmoydeb.tymar.savedState",
  ]
end
