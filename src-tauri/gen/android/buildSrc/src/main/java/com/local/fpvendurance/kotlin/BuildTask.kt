import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject
import org.gradle.process.ExecOperations

abstract class BuildTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @Input
    var rootDirRel: String? = null
    @Input
    var projectDir: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        // Project-local fallback for Windows without symbolic-link privileges.
        // Only the build script sets this after compiling both ABI libraries.
        val prebuilt = System.getenv("FPV_ANDROID_PREBUILT_DIR")
        if (!prebuilt.isNullOrBlank()) {
            val targetName = target ?: throw GradleException("target cannot be null")
            val profile = if (release == true) "release" else "debug"
            val abi = mapOf("aarch64" to "arm64-v8a", "x86_64" to "x86_64")[targetName]
                ?: throw GradleException("Unsupported prebuilt ABI: $targetName")
            val rustTarget = if (targetName == "aarch64") "aarch64-linux-android" else "x86_64-linux-android"
            val source = File(prebuilt, "$rustTarget/$profile/libfpv_endurance_lib.so")
            if (!source.isFile) throw GradleException("Native library missing: $source")
            val destination = File(projectDir, "src/main/jniLibs/$abi/libfpv_endurance_lib.so")
            destination.parentFile.mkdirs()
            source.copyTo(destination, overwrite = true)
            return
        }
        val executable = """npm""";
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )

                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("run", "--", "tauri", "android", "android-studio-script");

        execOperations.exec {
            workingDir(File(projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}