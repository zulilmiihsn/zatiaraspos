package com.zatiaras.pos.app

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.zatiaras.pos.core.data.access.AccessControlManager
import com.zatiaras.pos.core.data.access.LockableRoute
import com.zatiaras.pos.core.ui.components.AccessControlGate
import com.zatiaras.pos.feature.pos.presentation.PosScreen
import com.zatiaras.pos.feature.pos.presentation.cashrecord.CashRecordScreen
import com.zatiaras.pos.feature.reports.presentation.home.HomeDashboardRoute
import com.zatiaras.pos.feature.reports.presentation.pnl.PnlReportRoute
import com.zatiaras.pos.feature.pos.presentation.PosViewModel
import com.zatiaras.pos.NavRoutes
import com.zatiaras.pos.core.ui.theme.AppShapes
import com.zatiaras.pos.feature.pos.domain.model.CartHolder
import com.zatiaras.pos.feature.pos.domain.model.Transaction
import com.zatiaras.pos.feature.pos.navigation.PosRoutes
import com.zatiaras.pos.feature.pos.navigation.cashRecordScreen
import com.zatiaras.pos.feature.pos.navigation.posScreen
import com.zatiaras.pos.feature.reports.navigation.homeDashboardScreen
import com.zatiaras.pos.feature.reports.navigation.reportsScreen

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val iconFilled: ImageVector,
    val iconOutlined: ImageVector
) {
    data object Home : BottomNavItem(
        NavRoutes.HOME,
        "Beranda",
        Icons.Filled.Home,
        Icons.Outlined.Home
    )
    data object Pos : BottomNavItem(
        PosRoutes.POS,
        "Kasir",
        Icons.Filled.ShoppingCart,
        Icons.Outlined.ShoppingCart
    )
    data object CashRecord : BottomNavItem(
        NavRoutes.CASH_RECORD,
        "Catat",
        Icons.Filled.Receipt,
        Icons.Outlined.Receipt
    )
    data object Reports : BottomNavItem(
        NavRoutes.REPORTS,
        "Laporan",
        Icons.Filled.Analytics,
        Icons.Outlined.Analytics
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MainScreen(
    cartHolder: CartHolder,
    onNavigateBackFromMain: () -> Unit,
    onNavigateToCheckout: () -> Unit,
    onNavigateToChat: () -> Unit,
    onNavigateToReceipt: (Transaction) -> Unit,
    onNavigateToSettings: () -> Unit = {},
    accessControlManager: AccessControlManager? = null
) {
    val items = listOf(
        BottomNavItem.Home,
        BottomNavItem.Pos,
        BottomNavItem.CashRecord,
        BottomNavItem.Reports
    )

    val pagerState = rememberPagerState(pageCount = { items.size })
    val scope = rememberCoroutineScope()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            EnhancedBottomNavigationBar(
                items = items,
                selectedIndex = pagerState.currentPage,
                onItemClick = { index ->
                    scope.launch {
                        pagerState.animateScrollToPage(index)
                    }
                }
            )
        }
    ) { innerPadding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) { page ->
            when (items[page]) {
                BottomNavItem.Home -> {
                    HomeDashboardRoute(
                        onNavigateToSettings = onNavigateToSettings
                    )
                }
                BottomNavItem.Pos -> {
                    val viewModel: PosViewModel = hiltViewModel()
                    PosScreen(
                        onNavigateBack = { /* No back action for tab */ },
                        onProceedToCheckout = {
                            // Save cart to holder before navigating
                            cartHolder.updateCart(viewModel.getCurrentCart())
                            onNavigateToCheckout()
                        },
                        viewModel = viewModel
                    )
                }
                BottomNavItem.CashRecord -> {
                    if (accessControlManager != null) {
                        AccessControlGate(
                            accessControlManager = accessControlManager,
                            route = LockableRoute.CASH_RECORD_TAB.route,
                            screenName = "Buku Kas",
                            onAccessDenied = {
                                scope.launch { pagerState.animateScrollToPage(0) }
                            }
                        ) {
                            CashRecordScreen(
                                onNavigateBack = {
                                    scope.launch { pagerState.animateScrollToPage(0) }
                                },
                                onNavigateToReceipt = onNavigateToReceipt
                            )
                        }
                    } else {
                        CashRecordScreen(
                            onNavigateBack = {
                                scope.launch { pagerState.animateScrollToPage(0) }
                            },
                            onNavigateToReceipt = onNavigateToReceipt
                        )
                    }
                }
                BottomNavItem.Reports -> {
                    if (accessControlManager != null) {
                        AccessControlGate(
                            accessControlManager = accessControlManager,
                            route = LockableRoute.REPORTS_TAB.route,
                            screenName = "Laporan",
                            onAccessDenied = {
                                scope.launch { pagerState.animateScrollToPage(0) }
                            }
                        ) {
                            PnlReportRoute(
                                onNavigateBack = null,
                                onNavigateToChat = onNavigateToChat
                            )
                        }
                    } else {
                        PnlReportRoute(
                            onNavigateBack = null,
                            onNavigateToChat = onNavigateToChat
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EnhancedBottomNavigationBar(
    items: List<BottomNavItem>,
    selectedIndex: Int,
    onItemClick: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
        tonalElevation = 0.dp
    ) {
        NavigationBar(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp),
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
            tonalElevation = 0.dp
        ) {
            items.forEachIndexed { index, item ->
                val isSelected = selectedIndex == index
                
                EnhancedNavigationBarItem(
                    item = item,
                    selected = isSelected,
                    onClick = { onItemClick(index) }
                )
            }
        }
    }
}

@Composable
private fun RowScope.EnhancedNavigationBarItem(
    item: BottomNavItem,
    selected: Boolean,
    onClick: () -> Unit
) {
    // Smooth animations
    val animationSpec: AnimationSpec<Float> = tween(
        durationMillis = 300,
        easing = FastOutSlowInEasing
    )
    
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.1f else 1f,
        animationSpec = animationSpec,
        label = "iconScale"
    )
    
    val alpha by animateFloatAsState(
        targetValue = if (selected) 1f else 0.7f,
        animationSpec = animationSpec,
        label = "alpha"
    )
    
    val iconColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        },
        animationSpec = tween(durationMillis = 300),
        label = "iconColor"
    )
    
    val textColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        },
        animationSpec = tween(durationMillis = 300),
        label = "textColor"
    )
    
    val indicatorWidth by animateDpAsState(
        targetValue = if (selected) 32.dp else 0.dp,
        animationSpec = tween(
            durationMillis = 300,
            easing = FastOutSlowInEasing
        ),
        label = "indicatorWidth"
    )

    NavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Animated indicator pill on top of icon
                Box(
                    modifier = Modifier
                        .size(width = indicatorWidth, height = 3.dp)
                        .background(
                            color = MaterialTheme.colorScheme.primary,
                            shape = AppShapes.XS
                        )
                )
                
                // Icon with scale animation
                Icon(
                    imageVector = if (selected) item.iconFilled else item.iconOutlined,
                    contentDescription = item.title,
                    tint = iconColor,
                    modifier = Modifier
                        .size(26.dp)
                        .scale(scale)
                        .alpha(alpha)
                )
            }
        },
        label = {
            Text(
                text = item.title,
                color = textColor,
                fontSize = 12.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                modifier = Modifier.alpha(alpha)
            )
        },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = MaterialTheme.colorScheme.primary,
            selectedTextColor = MaterialTheme.colorScheme.primary,
            indicatorColor = Color.Transparent, // We use custom indicator
            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
        ),
        alwaysShowLabel = true
    )
}
