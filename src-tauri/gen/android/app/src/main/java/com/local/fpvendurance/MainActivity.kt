package com.local.fpvendurance

import android.os.Bundle
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        // Insets keep controls clear of status/navigation bars on edge-to-edge Android.
        val content = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val decor = window.decorView
                val ime = WindowInsetsCompat.Type.ime()
                if (ViewCompat.getRootWindowInsets(decor)?.isVisible(ime) == true) {
                    WindowInsetsControllerCompat(window, decor).hide(ime)
                    return
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("离开 FPV Endurance？")
                    .setMessage("关闭后会清空本次输入；切到后台可继续保留。")
                    .setNegativeButton("继续填写", null)
                    .setPositiveButton("离开") { _, _ -> finish() }
                    .show()
            }
        })
    }
}
